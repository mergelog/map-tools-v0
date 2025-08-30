# MapToolsV1

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.2.1.

## Map Tools V1

Leaflet + OSM + Leaflet Routing Machine をCDN経由で使用し、以下を実装しています。

- 画面全面の地図表示（左上に「Map TOOLs V1」）
- 地図を2点クリックでルート探索（LRMのルーター直接呼び出し）
- ルート表示・clearボタンでクリア
- ルート算出後にstartボタン表示、クリックで車（SVG）走行開始（約50km/h）
- 走行中はstop/clearを表示して停止やルートクリア可能
- ルート座標取得はリポジトリ層（`src/app/core/repositories/route-repository.ts`）からアクセス

注意: ルーティングは OSRM のデモサーバー（`router.project-osrm.org`）を利用しています。
本番用途では自前のOSRMバックエンドの用意をご検討ください。

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

If the map tiles or routing do not load, ensure your network allows access to the following endpoints:

- `tile.openstreetmap.org`（OSMタイル）
- `router.project-osrm.org`（OSRMルーティングAPI）

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## GitHub Pages

To publish at `https://mergelog.github.io/map-tools-v0/`:

- Build with the repository base path and copy output to `docs/`:

  ```bash
  yarn deploy:pages
  ```

- On GitHub, open your repository settings:
  - Settings → Pages → Source: “Deploy from a branch”
  - Branch: `main` and Folder: `/docs`

Notes:
- The build uses `--base-href /map-tools-v0/`. If your repository name or Pages URL differs, change this base in `package.json` script `build:pages` accordingly.
- For SPA deep links to work on Pages, `404.html` is created as a copy of `index.html`.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
