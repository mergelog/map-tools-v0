import { Component, OnDestroy, OnInit, computed, signal, inject } from '@angular/core';
import { NgIf, DecimalPipe } from '@angular/common';
import { TitleBadge } from '../../shared/components/title-badge/title-badge';
import { MapControls } from '../../shared/components/map-controls/map-controls';
import { LatLngDisplay } from '../../shared/components/lat-lng/lat-lng';
import { CurrentAddressComponent } from '../../shared/components/current-address/current-address';
import { CurrentPositionComponent } from '../../shared/components/current-position/current-position';
import { CurrentAddressStore } from '../../core/stores/current-address.store';
import { CurrentPositionStore } from '../../core/stores/current-position.store';
import { RouteRepository, LatLng } from '../../core/repositories/route-repository';
import { GeocodeRepository } from '../../core/repositories/geocode-repository';
import * as L from 'leaflet';
import 'leaflet-routing-machine';

/**
 * MapPage
 *
 * Leaflet + OSM を用いたフルスクリーン地図ページ。
 * - 2点クリックでルート取得（LRM/OSRM）し、ポリラインを表示
 * - SVGの車アイコンがルート上を走行（速度調整・追従・停止/再開）
 * - 右上HUDで緯度経度・出発/到着住所・総距離・ETA(JST)を表示
 */

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [NgIf, DecimalPipe, TitleBadge, MapControls, LatLngDisplay, CurrentAddressComponent, CurrentPositionComponent],
  templateUrl: './page.html',
  styleUrl: './page.scss'
})
export class MapPage implements OnInit, OnDestroy {
  /** Leaflet の地図インスタンス */
  private map!: L.Map;
  /** ルーティング用リポジトリ（LRM/OSRM） */
  private readonly repo = inject(RouteRepository);
  /** 逆ジオコーディング用リポジトリ（Nominatim） */
  private readonly geocode = inject(GeocodeRepository);
  /** クリックで指定された2点（出発→到着） */
  private clickPoints: LatLng[] = [];
  /** クリック点用のLeafletマーカー */
  private markers: L.Marker[] = [];
  /** 現在のルートのポリライン */
  private routeLine: L.Polyline | null = null;
  /** 車マーカー（SVGのdivIcon） */
  private carMarker: L.Marker | null = null;
  /** requestAnimationFrameのハンドル */
  private animHandle: number | null = null; // rAF id
  private startTime = 0;
  private lastTime = 0;
  /** ルート座標列 */
  private path: LatLng[] = [];
  /** 現在のセグメントインデックス（path[i]→path[i+1]） */
  private segIndex = 0; // current segment index
  /** 現在セグメント内の進捗[m] */
  private segProgress = 0; // meters progressed on current segment
  /** 速度[km/h]（UIで調整可能） */
  protected speedKmH = signal(60); // 20–180 km/h
  /** 速度[m/s] のcomputed */
  private readonly speedMps = computed(() => (this.speedKmH() * 1000) / 3600);
  private lastEtaAt = 0;
  private readonly currentAddressStore = inject(CurrentAddressStore);
  private readonly currentPositionStore = inject(CurrentPositionStore);

  /** 処理中フラグ（ルート取得など） */
  protected busy = false;

  /** ルート/走行/HUD関連のシグナル */
  protected hasRoute = signal(false);
  protected running = signal(false);
  protected hudLatLng = signal<LatLng | null>(null);
  protected startAddress = signal('');
  protected endAddress = signal('');
  protected etaJst = signal('');
  /** stop押下後のみstartボタンを表示する制御 */
  protected showStart = signal(false);
  /** 総距離[m] */
  protected totalMeters = signal(0);
  /** 追従モード（車を常に中央） */
  protected follow = signal(true);
  /** エラー/通知メッセージ（短時間表示） */
  protected notice = signal('');
  // 自動フォロー解除・ドラッグ検知は無効化
  // 自動フォロー解除は無効化（ユーザー操作で解除しない）

  /** 定数群 */
  private static readonly INITIAL = { lat: 43.068661, lng: 141.350755, zoom: 14 } as const;
  private static readonly POLYLINE = { color: '#0077ff', weight: 5 } as const;
  private static readonly SPEED_RANGE = { min: 20, max: 180 } as const;
  private static readonly ETA_THROTTLE_MS = 500;

  /**
   * 地図初期化・ベースレイヤ・クリックハンドラ設定
   *
   * 処理概要:
   * 1) Leafletマップを生成（ズーム/帰属UI設定・初期中心/ズーム）
   * 2) OSMタイルレイヤを追加（帰属はHUD側に表示）
   * 3) クリックイベントを購読（2点クリック→ルート探索の入り口）
   *
   * 入出力/副作用:
   * - 入力なし
   * - 出力なし
   * - this.map を生成し、DOM要素 #map にアタッチ
   */
  public ngOnInit(): void {
    // 地図を初期化
    this.map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([MapPage.INITIAL.lat, MapPage.INITIAL.lng], MapPage.INITIAL.zoom); // Sapporo Station default

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    // OSMの帰属表記は必須のため、HUD内に独自表示

    this.map.on('click', (e: any) => this.handleMapClick(e));
  }

  /**
   * 破棄処理
   *
   * 処理概要:
   * 1) rAFを停止
   * 2) クリックハンドラを解除
   * 3) Leafletマップを破棄
   *
   * 入出力/副作用:
   * - DOM要素から地図を除去
   */
  public ngOnDestroy(): void {
    this.stopAnim();
    if (this.map) {
      this.map.off('click', this.handleMapClick);
      this.map.remove();
    }
  }

  /**
   * クリア処理（UIからのclearボタン）
   *
   * 処理概要:
   * 1) 走行が動いていれば停止
   * 2) ルート・車マーカー・HUDデータを全消去
   * 3) クリックで置いたマーカーも全消去
   * 4) 走行/ルートの状態フラグをリセット
   *
   * 注意:
   * - followはデフォルトONに戻る（clearRoute内で設定）
   */
  protected onClear(): void {
    this.stopAnim();
    this.clearRoute();
    this.clearPoints();
    this.hasRoute.set(false);
    this.running.set(false);
  }

  /**
   * 停止処理（UIからのstopボタン）
   *
   * 処理概要:
   * 1) rAFループ停止 + running=false
   * 2) HUDの現在位置・ETAをクリア
   * 3) 再開用に start ボタンを表示（showStart=true）
   */
  protected onStop(): void {
    if (!this.running()) return;
    this.running.set(false);
    this.stopAnim();
    this.hudLatLng.set(null);
    this.currentPositionStore.clear();
    this.etaJst.set('');
    this.showStart.set(true);
    this.currentAddressStore.clear();
  }

  /**
   * 再開処理（UIからのstartボタン）
   *
   * 前提:
   * - hasRoute=true かつ running=false
   *
   * 処理概要:
   * 1) running=true, startボタンを隠す
   * 2) rAFループ再開（現在のセグメントと進捗から継続）
   */
  protected onStart(): void {
    if (this.running() || !this.hasRoute()) return;
    this.running.set(true);
    this.showStart.set(false);
    this.startAnim();
  }

  /**
   * 地図クリック処理
   *
   * 処理概要:
   * 1) running中は無視（編集中断の混乱を避ける）
   * 2) 3点目がクリックされた場合はまず全クリア
   * 3) マーカー追加 → clickPoints に保持
   * 4) 2点そろったら:
   *    4-1) busy=true で二重起動を抑止
   *    4-2) Repository経由でLRM/OSRMにルート要求
   *    4-3) 取得した座標でポリライン描画 + 総距離計算 + 表示域フィット
   *    4-4) 出発/到着の住所を逆ジオコーディング
   *    4-5) running=true にして自動走行を開始
   * 5) エラー時はHUDに通知を出し、状態をクリア
   *
   * 入出力/副作用:
   * - 入力: クリック座標（Leafletのイベント）
   * - 出力: なし
   * - 副作用: マーカー/ポリライン/車アイコンの追加・状態更新
   */
  private handleMapClick = async (e: any) => {
    if (this.busy || this.running()) return;

    const ll: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
    if (this.clickPoints.length >= 2) {
      this.onClear();
    }

    this.addMarker(ll);
    this.clickPoints.push(ll);

    if (this.clickPoints.length === 2) {
      try {
        this.busy = true;
        const [a, b] = this.clickPoints;
        const coords = await this.repo.getRouteCoords(a, b);
        this.drawRoute(coords);
        this.fitBoundsToRoute(coords);
        this.hasRoute.set(true);
        // 出発/到着の住所を取得
        this.lookupEndpointsAddresses(a, b);
        // ルート準備完了後に自動走行開始
        this.running.set(true);
        this.startAnim();
        this.showStart.set(false);
      } catch (err) {
        console.error(err);
        this.showNotice('ルート探索に失敗しました');
        this.onClear();
      } finally {
        this.busy = false;
      }
    }
  };

  /**
   * マーカー追加
   *
   * 処理概要:
   * - start/end を判定し、対応するSVGを使って `divIcon` マーカーを作成
   * - 地図へ追加し、破棄用に内部リストへ保持
   */
  private addMarker(p: LatLng) {
    const type = this.clickPoints.length === 0 ? 'start' : 'end';
    const icon = this.getMarkerIcon(type);
    const m = L.marker([p.lat, p.lng], { icon });
    m.addTo(this.map);
    this.markers.push(m);
  }

  /**
   * マーカーアイコン生成
   *
   * 処理概要:
   * - public/svg 配下の start/end 用アイコンを `<img>` で読み込み
   * - `L.divIcon` を返却（位置合わせのため iconAnchor を設定）
   */
  private getMarkerIcon(type: 'start' | 'end' | 'point' = 'point') {
    const src = type === 'start' ? '/svg/marker-start.svg' : type === 'end' ? '/svg/marker-end.svg' : '/svg/marker-start.svg';
    const html = `<img class="marker-svg" src="${src}" width="28" height="36" alt="marker" />`;
    return L.divIcon({
      className: 'marker-icon',
      html,
      iconSize: [28, 36],
      iconAnchor: [14, 34]
    });
  }

  /**
   * クリック点（start/end）のマーカーを全削除
   *
   * 処理概要:
   * - 地図から remove()
   * - 内部配列を空に
   */
  private clearPoints() {
    for (const m of this.markers) m.remove();
    this.markers = [];
    this.clickPoints = [];
  }

  /**
   * ルート描画
   *
   * 処理概要:
   * 1) 既存ルートのクリア
   * 2) path を更新
   * 3) ポリライン描画（色/太さは定数）
   * 4) 総距離を隣接点の合計として計算
   * 5) 先頭位置に車アイコンを配置
   */
  private drawRoute(coords: LatLng[]) {
    this.clearRoute();
    this.path = coords;
    this.routeLine = L.polyline(coords, MapPage.POLYLINE).addTo(this.map);
    // 総距離を計算
    let meters = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      meters += L.latLng(coords[i].lat, coords[i].lng).distanceTo(
        L.latLng(coords[i + 1].lat, coords[i + 1].lng)
      );
    }
    this.totalMeters.set(Math.round(meters));
    this.resetCar();
  }

  /**
   * ルートクリア
   *
   * 処理概要:
   * - ポリライン/車アイコンの remove
   * - 走行状態やHUD（住所/ETA/距離/位置）を初期化
   * - follow はデフォルトONに戻す
   */
  private clearRoute() {
    if (this.routeLine) this.routeLine.remove();
    this.routeLine = null;
    if (this.carMarker) this.carMarker.remove();
    this.carMarker = null;
    this.path = [];
    this.segIndex = 0;
    this.segProgress = 0;
    this.hasRoute.set(false);
    this.hudLatLng.set(null);
    this.startAddress.set('');
    this.endAddress.set('');
    this.etaJst.set('');
    this.showStart.set(false);
    this.totalMeters.set(0);
    this.follow.set(true);
    this.currentPositionStore.clear();
    this.currentAddressStore.clear();
  }

  /**
   * 車アイコン初期化
   *
   * 処理概要:
   * - 既存の車アイコンを除去
   * - public/svg の car.svg を `<img>` で読み込み `divIcon` を作成
   * - ルート先頭の座標にマーカーを配置
   */
  private resetCar() {
    if (!this.path.length) return;
    if (this.carMarker) this.carMarker.remove();

    const iconHtml = `
      <div class="car-inner" style="will-change: transform;">
        <img src="/svg/car.svg" width="48" height="48" alt="car" />
      </div>`;

    const icon = L.divIcon({
      className: 'car-icon',
      html: iconHtml,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    this.carMarker = L.marker([this.path[0].lat, this.path[0].lng], { icon, zIndexOffset: 1000 }).addTo(this.map);
  }

  /**
   * アニメーション開始
   *
   * 処理概要:
   * - `requestAnimationFrame` でループを張り、毎フレーム `advance()` を呼ぶ
   * - 外部で running=false になったら早期return
   */
  private startAnim() {
    if (!this.path.length) return;
    this.startTime = performance.now();
    // 走行開始時に最大ズームで車位置へ寄せる（followが有効な場合）
    try {
      if (this.follow()) {
        const maxZ = (this.map as any)?.getMaxZoom ? (this.map as any).getMaxZoom() : 19;
        const ll = this.carMarker
          ? this.carMarker.getLatLng()
          : L.latLng(this.path[0].lat, this.path[0].lng);
        this.map.setView(ll, maxZ, { animate: true });
      }
    } catch {}
    this.lastTime = this.startTime;
    const step = (t: number) => {
      if (!this.running()) return; // 外部で停止された場合
      const dt = Math.max(0, t - this.lastTime) / 1000; // 経過秒
      this.lastTime = t;
      this.advance(dt);
      this.animHandle = requestAnimationFrame(step);
    };
    this.animHandle = requestAnimationFrame(step);
  }

  /**
   * アニメーション停止
   *
   * 処理概要:
   * - `cancelAnimationFrame` でループ停止
   */
  private stopAnim() {
    if (this.animHandle) cancelAnimationFrame(this.animHandle);
    this.animHandle = null;
  }

  /**
   * 前進計算
   *
   * 処理概要:
   * 1) 現在の速度[m/s] × 経過秒 で移動距離を算出
   * 2) 現在セグメントの残距離と比較して、
   *    - 収まる場合: segProgress を加算し、区間内の補間位置へ
   *    - はみ出す場合: 次セグメントへ繰り上げ（残距離を減算）
   * 3) 最終セグメントの末尾に到達したら走行を終了
   *
   * 入出力/副作用:
   * - 入力: dt（経過秒）
   * - 副作用: segProgress/segIndex の更新、車位置の更新
   */
  private advance(dt: number) {
    if (!this.carMarker || this.path.length < 2) return;
    let remaining = this.speedMps() * dt; // 進む距離[m]

    while (remaining > 0 && this.segIndex < this.path.length - 1) {
      const a = this.path[this.segIndex];
      const b = this.path[this.segIndex + 1];
      const A = L.latLng(a.lat, a.lng);
      const B = L.latLng(b.lat, b.lng);
      const segLen = A.distanceTo(B);

      const distLeft = segLen - this.segProgress;
      if (remaining < distLeft) {
        this.segProgress += remaining;
        remaining = 0;
        const ratio = this.segProgress / segLen;
        const pos = this.lerp(a, b, ratio);
        this.updateCar(pos, a, b);
      } else {
        // 次のセグメントへ
        remaining -= distLeft;
        this.segIndex++;
        this.segProgress = 0;
        this.updateCar(b, a, b);
      }
    }

    if (this.segIndex >= this.path.length - 1) {
      // 到着（到着地点で一度だけグローバルの位置・住所を更新）
      try {
        const finalPos = this.carMarker
          ? this.carMarker.getLatLng()
          : L.latLng(this.path[this.path.length - 1].lat, this.path[this.path.length - 1].lng);
        this.currentPositionStore.push(finalPos.lat, finalPos.lng);
        this.currentAddressStore.updateOnceNow(finalPos.lat, finalPos.lng);
      } catch {}
      this.running.set(false);
      this.stopAnim();
    }
  }

  /**
   * 車の座標/向き更新
   *
   * 処理概要:
   * 1) 車マーカーの座標を更新
   * 2) 2点間の方位角を計算 → SVG基準（右向き）に -90° 補正
   * 3) 見た目が上下逆さに見えないよう、角度が(90,270)に入る場合は
   *    180°戻した上で左右反転（scaleX）を併用
   * 4) running中はHUDに現在位置を反映、追従ONなら map.setView で中央維持
   */
  private updateCar(pos: LatLng, prev: LatLng, next: LatLng) {
    if (!this.carMarker) return;
    this.carMarker.setLatLng([pos.lat, pos.lng]);
    const bearing = this.computeBearing(prev, next);
    const el = this.carMarker.getElement() as HTMLElement | null;
    const inner = el?.querySelector('.car-inner') as HTMLElement | null;
    if (inner) {
      inner.style.transformOrigin = 'center center';
      const offset = -90; // 右向き基準のSVGを北向きに補正
      let heading = (bearing + offset) % 360;
      if (heading < 0) heading += 360;
      let angle = heading;
      let flipX = false;
      if (angle > 90 && angle < 270) {
        angle -= 180; // 回転角を±90°内に正規化
        flipX = true; // 左右反転で見た目の上方向を維持
      }
      inner.style.transform = `rotate(${angle}deg)${flipX ? ' scaleX(-1)' : ''}`;
    }

    // 走行中はHUD（現在位置）を更新
    if (this.running()) {
      this.hudLatLng.set(pos);
      // グローバルにも現在位置を保持
      this.currentPositionStore.push(pos.lat, pos.lng);
      this.maybeUpdateEta();
      if (this.follow()) {
        // 現在のズームを維持したまま車を画面中央へ（ユーザードラッグ中は抑止）
        this.map.setView([pos.lat, pos.lng], this.map.getZoom(), { animate: false });
      }
      // 現在地（高頻度）をグローバルストアへ送る（ストア側で2秒毎に逆ジオ）
      this.currentAddressStore.pushLatLng(pos.lat, pos.lng);
    }
  }

  /**
   * 線形補間
   * - a→b の途中 t(0..1) における座標を返す
   */
  private lerp(a: LatLng, b: LatLng, t: number): LatLng {
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  }

  /**
   * 方位角の算出
   * - 北=0°, 東=90° の右回り角度を返す
   * - 地球座標をラジアンに変換して計算
   */
  private computeBearing(a: LatLng, b: LatLng): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const φ1 = toRad(a.lat);
    const φ2 = toRad(b.lat);
    const λ1 = toRad(a.lng);
    const λ2 = toRad(b.lng);
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  /**
   * 表示域フィット
   * - ルートの全座標から境界を作り、パディング付きで fitBounds
   */
  private fitBoundsToRoute(coords: LatLng[]) {
    const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lng]));
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  /**
   * 住所取得（出発/到着）
   * - Nominatimで並列リクエストし、HUDに反映
   */
  private async lookupEndpointsAddresses(start: LatLng, end: LatLng) {
    try {
      const [sa, ea] = await Promise.all([
        this.geocode.reverse(start.lat, start.lng, 'ja'),
        this.geocode.reverse(end.lat, end.lng, 'ja')
      ]);
      if (sa) this.startAddress.set(sa);
      if (ea) this.endAddress.set(ea);
    } catch {}
  }
 
  /**
   * 速度変更（子コンポーネントからの通知）
   * - 値を最小/最大でクランプして signal に反映
   */
  protected onSpeedChange(v: number) {
    if (Number.isFinite(v)) {
      const clamped = Math.min(MapPage.SPEED_RANGE.max, Math.max(MapPage.SPEED_RANGE.min, v));
      this.speedKmH.set(clamped);
    }
  }

  /**
   * 追従ON/OFF
   * - follow をトグルし、ONにした直後は現在位置へセンタリング
   */
  protected onToggleFollow() {
    const next = !this.follow();
    this.follow.set(next);
    const pos = this.hudLatLng();
    if (next && pos) {
      // フォローON: 直ちにセンタリング
      this.map.setView([pos.lat, pos.lng], this.map.getZoom(), { animate: false });
    }
  }

  /**
   * ETA更新（JST）
   *
   * 処理概要:
   * 1) スロットル間隔（既定500ms）より短ければスキップ
   * 2) 残距離[m] / 速度[m/s] から到着までの秒数を算出
   * 3) 現在時刻に加算して到着時刻のDateを作成
   * 4) Intl.DateTimeFormat('ja-JP', tz=Asia/Tokyo) で整形してHUDに反映
   */
  private maybeUpdateEta() {
    const now = performance.now();
    if (now - this.lastEtaAt < MapPage.ETA_THROTTLE_MS) return; // throttle updates
    this.lastEtaAt = now;
    const remaining = this.computeRemainingMeters();
    const speed = this.speedMps();
    if (speed <= 0 || !isFinite(remaining)) {
      this.etaJst.set('');
      return;
    }
    const seconds = remaining / speed;
    const etaDate = new Date(Date.now() + seconds * 1000);
    const fmt = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    this.etaJst.set(fmt.format(etaDate));
  }

  /**
   * 残距離計算
   * - 現在セグメントの残り + 以降のセグメント長の合計をメートルで返す
   */
  private computeRemainingMeters(): number {
    if (!this.path.length) return NaN;
    let meters = 0;
    const i = this.segIndex;
    if (i < this.path.length - 1) {
      const a = this.path[i];
      const b = this.path[i + 1];
      const segLen = L.latLng(a.lat, a.lng).distanceTo(L.latLng(b.lat, b.lng));
      meters += Math.max(0, segLen - this.segProgress);
      for (let j = i + 1; j < this.path.length - 1; j++) {
        const p = this.path[j];
        const q = this.path[j + 1];
        meters += L.latLng(p.lat, p.lng).distanceTo(L.latLng(q.lat, q.lng));
      }
    }
    return meters;
  }

  /**
   * 簡易通知の表示
   * - notice signal にメッセージを設定し、一定時間後に自動クリア
   */
  private showNotice(message: string, ms = 3000) {
    this.notice.set(message);
    setTimeout(() => {
      if (this.notice() === message) this.notice.set('');
    }, ms);
  }

  // 自動フォロー解除の仕組みは一旦無効化
  // 自動フォロー解除ロジックは削除
}
