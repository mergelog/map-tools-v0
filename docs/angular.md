# Angular 実装メモ（map-tools-v1）

本ドキュメントは、本プロジェクトのAngular実装方針と主要な設計判断をまとめたものです。開発・保守の観点での意図を共有します。

## フォルダ構成（Feature-Based + Core/Shared）

- `src/app/features/map/` 地図機能のスタンドアロンページ（`page.ts/html/scss`）
- `src/app/core/repositories/` データ取得層（Repository）
  - `route-repository.ts`（LRM/OSRMでルート座標）
  - `geocode-repository.ts`（Nominatimで逆ジオコーディング）
- `public/svg/` 共有SVG資産（車・マーカー）

Angular v17+の「スタンドアロン」構成に沿い、機能単位でコードを集約。共通化対象（アイコン等）は `public/` に置きます。

## コンポーネント設計

- スタンドアロン（`standalone: true`）。
- ルーティングは `app.routes.ts` でMapページをトップに。
- Leaflet/LRMはnpm導入（CommonJS許可は `angular.json` の `allowedCommonJsDependencies`）。
- OSMの帰属はHUD内に独自表示（LeafletのUIは無効化）。

## アクセス修飾子の方針

- テンプレートから参照するものは `protected`。
  - 例: `speedKmH`, `running`, `follow`, `hudLatLng`, `startAddress`, `endAddress`, `etaJst`, `totalMeters`、`onSpeedInput`, `onToggleFollow`, `onStart`, `onStop`, `onClear`。
- 内部実装は `private`（Leafletのインスタンスや計算関数など）。
- ライフサイクルには明示的に `public`（`ngOnInit`, `ngOnDestroy`）。

## Signalベースの状態管理

- Angular Signals を使用（`signal()`）。
- UIと相性が良く、`running` やHUD表示の更新をシンプルに記述可能。

## 地図・ルーティング・アニメーション要点

- 2クリックで出発/到着を確定 → Repository経由でLRM/OSRMに問い合わせ → ポリライン描画。
- 車アイコン（SVG）がルート上を走行。速度は20〜100 km/hのスライダーで調整。
- 追従ONで車を常時中央に維持。stop→startで再開可能。clearで状態クリア。
- HUD（右上）に緯度経度、出発/到着住所、総距離、ETA（JST）。住所は確定時のみ逆ジオコーディング。

## アセット管理（SVG）

- `public/svg/` に集約し、コンポーネントでは `<img src="/svg/...">` で参照。
  - 差し替え容易・バンドルサイズを抑制。

## OSM帰属とコンプライアンス

- 「© OpenStreetMap contributors」をHUDに表示（非表示にはしない）。

## パフォーマンス

- 距離計算は `distanceTo`、進行は `requestAnimationFrame` + 線形補間。
- ETAは0.5秒スロットル。逆ジオは出発/到着のみ。
