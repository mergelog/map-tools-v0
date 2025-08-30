# Angular Best Practice & SRP Analysis

## 概要

プロジェクトのソースコードを分析し、「単一責任の原則（SRP）」と「モダンAngularのベストプラクティス」の観点から評価しました。

**総評:** このプロジェクトは全体として非常によく構成されており、関心の分離が明確です。モダンAngularの機能を効果的に活用し、単一責任の原則にも概ね準拠しています。

---

## 1. 単一責任の原則 (Single Responsibility Principle)

各クラスやファイルが単一の責任に集中しているかを評価します。

### Components (`page.ts`, `current-address.ts` など)

- **評価:** **概ね良好**
- **`MapPage` (`page.ts`):**
    - **責任:** 地図の表示、ユーザーインタラクション（クリック、UI操作）、および関連する状態の管理。
    - **分析:** このコンポーネントは多くのロジックを抱えていますが、その責務は「地図ページ全体の統括」という一点に集中しています。
    - 実際のルート探索、逆ジオコーディング、走行アニメーションの計算といった**具体的な処理は、それぞれ`RouteRepository`, `GeocodeRepository`, `RoutePlayerService`に委譲**できており、SRPを遵守しようとする良い設計です。
    - 状態管理に`signal`を多用していますが、ロジックが複雑化すると見通しが悪くなる可能性があります。現状の規模では問題ありません。
- **`CurrentAddressComponent` (`current-address.ts`):**
    - **責任:** `CurrentAddressStore`から受け取った住所を表示すること。
    - **分析:** 完全にStoreに依存したPresentational Component（表示に特化したコンポーネント）です。自身のロジックを持たず、単一責任を完璧に満たしています。

### Services (`route-player.service.ts`)

- **評価:** **良好**
- **`RoutePlayerService`:**
    - **責任:** ルート(`path`)と速度(`speedProvider`)に基づき、`requestAnimationFrame`ループで座標を算出し、`pos$`を通じて外部に通知すること。
    - **分析:** アニメーションの計算という単一の責務に特化しています。状態（`segIndex`, `segProgress`）を内部で持ち、外部には現在位置を通知するだけという、理想的なServiceの形です。

### Repositories (`geocode-repository.ts`, `route-repository.ts`)

- **評価:** **非常に良好**
- **`GeocodeRepository`:**
    - **責任:** 緯度経度から住所文字列を取得するために、外部API（Nominatim）と通信すること。
    - **分析:** データ取得と、取得後の簡単な整形処理（`formatJapaneseAddress`）に責務が限定されています。APIとの通信という単一責任を見事に果たしています。
- **`RouteRepository` (ファイルは未提供だが推測):**
    - **責任:** 出発地と目的地からルート座標のリストを取得するために、外部API（OSRM）と通信すること。
    - **分析:** `GeocodeRepository`と同様に、データ取得という単一責任を担っていると推測され、良い設計パターンです。

### Stores (`current-address.store.ts`)

- **評価:** **良好**
- **`CurrentAddressStore`:**
    - **責任:** 高頻度で更新される緯度経度を効率的に処理（間引き、重複排除）し、逆ジオコーディングを実行して、最終的な住所文字列の状態を管理・提供すること。
    - **分析:** RxJSのオペレーターを駆使して、複雑な非同期のデータフローを「住所の管理」という単一の責務にまとめています。これはStoreパターンの優れた実践例です。

### Utils (`geo.ts`)

- **評価:** **非常に良好**
- **`geo.ts`:**
    - **責任:** 状態を持たない、地理計算に関する純粋な関数（`haversine`, `bearing`, `lerp`など）を提供すること。
    - **分析:** 再利用可能な計算ロジックを切り出すというUtilsの役割を完璧に果たしています。

---

## 2. モダンAngularのベストプラクティス

Angular v17以降で推奨されている主要な機能の採用状況を評価します。（※Angular v20はリリースされていないため、最新の安定版で推奨されるプラクティスを基準とします）

### Standalone API

- **評価:** **採用済み・良好**
- **分析:** `app.config.ts`での`provideRouter`や`provideHttpClient`の使用、および各コンポーネントの`standalone: true`フラグから、プロジェクトが完全にStandalone APIベースで構築されていることがわかります。これはNgModuleから脱却した最新のベストプラクティスです。

### Zoneless Change Detection

- **評価:** **採用済み・良好**
- **分析:** `app.config.ts`で`provideZonelessChangeDetection()`が呼ばれており、Zone.jsに依存しない変更検知を有効化しています。これはパフォーマンス向上に寄与する先進的な機能です。

### Signals

- **評価:** **採用済み・良好**
- **分析:** `MapPage`コンポーネントでは、UIの状態管理（`speedKmH`, `hasRoute`, `running`など）に`signal`と`computed`が積極的に活用されています。これにより、変更検知が効率化され、コードのリアクティビティが向上しています。

### Dependency Injection (DI)

- **評価:** **良好**
- **分析:** `inject()`関数がコンポーネントやサービスクラスの`constructor`外（プロパティ初期化時）で使われており、モダンなDIのスタイルに沿っています。

### 型安全性

- **評価:** **概ね良好**
- **分析:** `LatLng`などの型が定義され、コード全体で型が意識されています。ただし、`GeocodeRepository`や`MapPage`内で`any`型が一部使用されています（`data: any`, `e: any`）。可能であれば、これらに具体的な型（例: `L.LeafletMouseEvent`）を定義すると、より堅牢になります。

## 結論と推奨事項

- **結論:** このプロジェクトは、単一責任の原則とモダンAngularのベストプラクティスを非常によく遵守した、質の高いコードベースです。
- **推奨事項:**
    1. **型の厳格化:** `any`型が残っている箇所に、適切な型定義を施すことを推奨します。これにより、コンパイル時のチェックが強化され、予期せぬバグを防ぐことができます。
    2. **`MapPage`の責務分割の検討:** 現状でも十分に責務は分離されていますが、将来的に機能がさらに複雑化する場合（例: 複数ルートの比較、経由地の追加など）、`MapPage`からUI状態管理ロジックの一部を別のServiceやStoreに切り出すことを検討しても良いかもしれません。
