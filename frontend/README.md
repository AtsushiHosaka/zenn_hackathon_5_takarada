# frontend

React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query + React Router の SPA。

```bash
# リポジトリ直下で (backend ごと立つ)
make up            # => http://localhost:5173

# ホストの node で動かす場合
npm install
npm run dev
```

**dev の既定はダミー接続**なので、backend を立てなくてもログインから一覧・更新・削除まで動く。
実 API を叩くならログイン画面 / ヘッダの「接続先」を `API` に切り替える。

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | 型チェック + 本番ビルド (`dist/`) |
| `npm run lint` | eslint |
| `npm run typecheck` | tsc |
| `npm run types` | `../backend/swagger/v1/swagger.yaml` から TS 型を再生成 |

規約・レイヤ構成・エンドポイントの足し方は [.claude/docs/frontend.md](../.claude/docs/frontend.md)。
