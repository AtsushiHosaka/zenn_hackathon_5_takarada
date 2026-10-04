# プロジェクトの仕様ソース

Google Docs URL:

fork後に上の空欄へ、このプロジェクトのGoogle Docs URLを記入する。

## 何を正とするか

- Google Docs：目的、機能の範囲、期待する振る舞い、受け入れ条件のSSOT。
- `specs/<feature>/spec.md`：Docsから必要部分を具体化した実装メモ。独立した要求の正本にしない。
- `backend/spec/requests/` と `backend/spec/swagger_helper.rb`：API契約の生成元。
- `backend/swagger/v1/swagger.yaml`：生成された共有OpenAPI。手で直さず `make docs` で更新する。
- `backend/db/Schemafile`：DBスキーマの正本。

## Google Docsの読み取り

- Google Docs対応のスキルからMCPを利用する。利用可能な読み取りToolsは実行時に取得し、ツール名を固定しない。
- 作業に関係するDocsの本文・タブを読み、実装メモにはURL・該当箇所・取得日時を残す。
- 部分取得は全文確認と扱わない。URL未設定・権限不足・取得失敗は明示し、内容や最新版を推測しない。
- URLが空欄なら、依頼文・提供された抜粋・既存資料を暫定の根拠として使い、Docs確認済みとは書かない。
- 不足が作業結果を大きく左右する場合だけ確認し、関係しない作業は進める。
- Docsへの書き込みは読み取り依頼に含まれない。AIの提案・仮定・追記案は実装メモに分けて残す。
- Docsと実装が食い違ったら差分を残す。明示されたユーザーの変更は作業に反映し、Docs未反映と記す。
- 固定フローや全文コピーは不要。実装先行でも重要な判断と未反映の差分を失わない。

## 接続に必要な情報

API契約は上記OpenAPIと `/api-docs` を共有する。未実装のAPIは利用可能と表現しない。
公開URLは `make infra-url` で確認し、iOSの `ios/Info.plist` の `API_ENDPOINT`、Webフロントの `VITE_API_ENDPOINT` に設定する。
起動・環境変数は [README](../README.md)、[infra](../infra/gcp/README.md)、[frontend規約](../.claude/docs/frontend.md)、[iOS規約](../.claude/docs/ios.md) を参照する。
実APIでの確認と、Webフロント・iOSの既定のダミー接続での確認を区別する。
`frontend/src/data/generated/api.ts` は上記OpenAPIからの生成物。手で直さず `make front-types` で更新する。
