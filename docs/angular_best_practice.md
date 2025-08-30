# Angular スタイルガイド（v20）— 実務完全版

> 目的：**命名／構造／DI／コンポーネント設計／テンプレート作法／可視API管理**を網羅し、チームで迷わない“完成形”運用基準を提示します。  
> 本書はAngular日本語版スタイルガイド（v20）を核に、実務での判断軸とサンプルを補強したものです（主要根拠は各所に明示）。

---

## 1) 基本理念と適用方針
- このガイドは**必須ではないが、プロジェクト横断の一貫性**のために採用する（TypeScript一般論は別途参照）。  
  根拠: 「はじめに」「迷ったときは一貫性を優先」 :contentReference[oaicite:0]{index=0}
- **ローカル整合性＞一般ルール**。既存ファイル内で矛盾が出る場合は、まず“当該ファイル内の一貫性”を優先。:contentReference[oaicite:1]{index=1}
- チーム規約は**PRテンプレ**・**ESLintルール**・**スキャフォールド**（schematics／codegen）に反映し、“人力レビュー依存”を最小化。

---

## 2) 命名規則（Naming）
- **ファイル名はハイフン区切り**：`user-profile.ts`。Specは**`.spec.ts`** で隣置き。:contentReference[oaicite:2]{index=2}
- **ファイル名＝中の主要識別子**。`helpers.ts` / `utils.ts` のような**過度な汎称は避ける**。納まらないなら分割。:contentReference[oaicite:3]{index=3}
- **コンポーネントの TS/HTML/CSS を同名ベースで揃える**（複数CSSは語尾に機能語を付与：`user-profile-settings.css` など）。:contentReference[oaicite:4]{index=4}

> 実務Tips
> - 生成スキーマに “名前の自動チェック” を組み込み、**誤命名PRを未然に防止**。
> - ルート・機能モジュール単位で**命名規則の差分**を作らない（例：一部だけスネークケース等は不可）。

---

## 3) ディレクトリ構造（Project Structure）
- **UIコードは `src/` に集約**。設定・スクリプト等の非UIは `src/` 外へ。**エントリポイントは `src/main.ts`**。:contentReference[oaicite:5]{index=5}
- **密接に関連するファイルを同居**（コンポーネントの TS/HTML/CSS/Spec）。**単一 `tests/` への集約は避ける**。:contentReference[oaicite:6]{index=6}
- **機能（feature）単位**でディレクトリ構成。`components/` / `services/` など**タイプ別ディレクトリは避ける**。:contentReference[oaicite:7]{index=7}
- **1ファイル1コンセプト**が原則。迷ったら**小さく分割**。:contentReference[oaicite:8]{index=8}

> 実務Tips
> - 1ディレクトリの**ファイル過密を検知**するスクリプト（例：閾値>20でアラート）をCIに組込み、肥大化を抑制。
> - **バレル（index.ts）乱用に注意**：可視APIが曖昧になり**循環依存の温床**になりやすい。外部公開境界だけで最小限に。

---

## 4) 依存性の注入（DI）
- **`inject()` を推奨**（コンストラクタ注入より可読・型推論に優れ、クラスフィールド初期化の制約を回避）。**自動移行ツール**あり。:contentReference[oaicite:9]{index=9}

```ts
// ✅ 推奨：inject()
import { inject, Component } from '@angular/core';
import { UserService } from './user.service';

@Component({ /*...*/ })
export class UserProfile {
  private readonly user = inject(UserService); // 依存一覧が見やすい／コメント付加もしやすい
}
```

```ts
// ⛔ 非推奨：多依存でのコンストラクタ肥大化
export class UserProfile {
  constructor(private user: UserService /* , private logger: Logger, ... */) {}
}
```

> 実務Tips
> - DI一覧は**クラス冒頭のブロック**に集約（後述「クラス構造」）。依存が7超で**抽象化or分割**を検討。

---

## 5) コンポーネント／ディレクティブ設計
### 5.1 セレクタとプレフィックス
- **アプリ固有のプレフィックス**を使用（例：`mr-`）。**属性セレクタ**は **camelCase**：`[mrTooltip]`。詳細は関連ガイド参照。:contentReference[oaicite:10]{index=10}

### 5.2 クラス構造（可視APIの整理）
- **Angular固有プロパティ（DI・input/model/output・クエリ）を先頭にグルーピング**し、**メソッドより前**に置く。:contentReference[oaicite:11]{index=11}
- **テンプレート専用メンバーは `protected`**（外部公開APIから排除）。:contentReference[oaicite:12]{index=12}
- **Angularが初期化するプロパティは `readonly`**（`input` / `model` / `output` / クエリ）。デコレータAPI使用時は `@Output` とクエリに適用。:contentReference[oaicite:13]{index=13}

```ts
@Component({ /*...*/ })
export class UserProfile {
  // --- Angular専用領域（先頭に集約） ---
  readonly userId = input<string>();        // Angular初期化 → readonly
  readonly saved  = output<void>();         // Angular初期化 → readonly
  protected fullName = computed(() => `${this.first()} ${this.last()}`);

  // --- privateな内部実装（UIロジック以外は外出し推奨） ---
  private first = input<string>();
  private last  = input<string>();
}
```

### 5.3 責務分離（UI専念）
- **プレゼンテーションに集中**。フォーム検証・変換など**独立可能ロジックは別関数／クラスへ抽出**。:contentReference[oaicite:14]{index=14}

---

## 6) テンプレート作法
- テンプレート式は**簡潔なロジックのみ**。**複雑化したら TypeScript 側へ抽出（`computed()` 等）**。:contentReference[oaicite:15]{index=15}

```html
<!-- ✅ OK：読みやすい -->
<p>{{ fullName() }}</p>

<!-- ⛔ NG：条件や整形が肥大化する場合はcomputed/関数へ -->
<p>{{ items.filter(i => i.visible && i.qty > 3).map(i => i.label).join(', ') }}</p>
```

> 実務Tips
> - **テンプレートの副作用**（関数内でサービス呼び出し等）は禁止。**pure関数＋メモ化**（`computed`）で再計算を最小化。
> - 構造ディレクティブは v20 の**新構文（`@if` / `@for` / `@switch`）**へ統一し、視認性と型安全を確保（別途プロジェクト規約で強制）。

---

## 7) テスト配置とスコープ
- **対象と同居する `.spec.ts`**。ユニットの**粒度は1コンポーネント／1パイプ／1サービス**を基本に、**DOM相互作用とロジックを分離**して検証。:contentReference[oaicite:16]{index=16}

> 実務Tips
> - UIは **Harness / Testing Library** で**ユーザ観点の選択子**を用い、内部実装詳細に過度に依存しない。
> - コンポーネントの**副作用（サービス呼び出し）**は**スパイ**で観測、**UIイベント→結果**の流れで記述。

---

## 8) 可視API（Public API）管理
- **`public`露出を最小限**にし、テンプレート専用は `protected`、内部は `private`。:contentReference[oaicite:17]{index=17}
- **feature境界の公開点**（barrelなど）は**最小に**。循環依存はGraphチェックで**CI落とし**。

---

## 9) 実務チェックリスト（導入・運用）
- **Lint/Format**：ESLint＋Prettier。`inject()`推奨／selector prefix／テンプレート複雑度のルール化。
- **Scaffold**：`ng g` テンプレに**命名・隣接配置・`.spec.ts`生成**を強制。
- **CI**：ディレクトリ過密検出、循環依存検出、Public API 監査、テンプレ式の副作用検査。
- **レビュー観点**：
  1) 責務：UI以外のロジックは分離済みか  
  2) テンプレ：式は簡潔か／computed抽出されているか  
  3) クラス：DI・input/output・クエリが先頭に整理され `readonly`/`protected` が適切か  
  4) 命名と配置：規約に適合か（ハイフン、.spec、同居）  
  5) Feature境界：依存方向が一方通行か／barrelの漏れがないか

---

## 10) サンプル構成（最小Feature単位）
```
src/
└─ movie-reel/
   ├─ show-times/
   │  ├─ film-calendar/
   │  │  ├─ film-calendar.ts
   │  │  ├─ film-calendar.html
   │  │  ├─ film-calendar.css
   │  │  └─ film-calendar.spec.ts
   │  └─ film-details/ ...
   └─ reserve-tickets/ ...
```
> **機能ごと**にまとめ、タイプ別の `components/` や `services/` は作らない。:contentReference[oaicite:18]{index=18}

---

## 参考（根拠）
- 命名・構造・DI・クラス構造・テンプレ作法・アクセス修飾子の原則は**Angular日本語版スタイルガイド（v20）**に基づく。必要箇所に明示出典あり：  
  - 一貫性優先／スコープ（はじめに） :contentReference[oaicite:19]{index=19}  
  - 命名（ハイフン、`.spec.ts`、識別子一致、同名TS/HTML/CSS） :contentReference[oaicite:20]{index=20}  
  - 構造（`src/` 集約、`main.ts`、同居、feature単位、1ファイル1コンセプト） :contentReference[oaicite:21]{index=21}  
  - DI（`inject()`推奨・自動移行ツール） :contentReference[oaicite:22]{index=22}  
  - コンポーネント/ディレクティブ（prefix、camelCase属性、先頭グルーピング、UI専念） :contentReference[oaicite:23]{index=23}  
  - テンプレ（複雑ロジックは TS 側へ、`computed` 推奨）／アクセス修飾子（`protected` / `readonly`） :contentReference[oaicite:24]{index=24}

---
### 付録：導入用 ESLint の一例（抜粋）
```json
{
  "rules": {
    "@angular-eslint/prefer-inject": "error",
    "@angular-eslint/component-max-inline-declarations": ["warn", { "template": 0, "styles": 0 }],
    "@angular-eslint/selectors": ["error", { "type": "attribute", "style": "camelCase", "prefix": ["mr"] }],
    "max-depth": ["warn", 2]
  }
}
```
> 目的：`inject()`推奨・セレクタ規約の強制・テンプレ複雑度の可視化。

