import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Subject, auditTime, distinctUntilChanged, map, switchMap, catchError, of } from 'rxjs';
import { GeocodeRepository } from '../repositories/geocode-repository';

export type Ll = { lat: number; lng: number };

@Injectable({ providedIn: 'root' })
export class CurrentAddressStore {
  private readonly geocode = inject(GeocodeRepository);

  // 入力となる現在地（高頻度）
  private readonly latLngInput$ = new Subject<Ll>();

  // 公開: 現在地住所
  private readonly addressState$ = new BehaviorSubject<string>('');
  readonly currentAddress$ = this.addressState$.asObservable();

  constructor() {
    this.latLngInput$
      .pipe(
        // 5秒に1度に抑制（走行中のみ push される）
        auditTime(5000),
        // 緯度経度の変化判定（小数6桁まで）
        map((p) => ({
          lat: Math.round(p.lat * 1e6) / 1e6,
          lng: Math.round(p.lng * 1e6) / 1e6
        })),
        distinctUntilChanged((a, b) => a.lat === b.lat && a.lng === b.lng),
        switchMap((p) =>
          this.geocode.reverse(p.lat, p.lng, 'ja').then((s) => s || '').catch(() => '')
        )
      )
      .subscribe((addr) => this.addressState$.next(addr));
  }

  // 現在地更新（走行中に高頻度で呼び出し）
  pushLatLng(lat: number, lng: number) {
    this.latLngInput$.next({ lat, lng });
  }

  // 即時に一度だけ住所を更新（到着時などに使用）
  async updateOnceNow(lat: number, lng: number, lang = 'ja') {
    try {
      const addr = (await this.geocode.reverse(lat, lng, lang)) || '';
      this.addressState$.next(addr);
    } catch {
      // ignore
    }
  }

  clear() {
    this.addressState$.next('');
  }
}
