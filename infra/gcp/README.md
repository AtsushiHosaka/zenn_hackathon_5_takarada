# infra/gcp — GCP の最小構成

Rails API と React フロントを **Cloud Run**、DB を **Cloud SQL** で動かす。
VPC・ロードバランサ・Redis は使わない。GCP に不慣れでも追えるだけの部品数に絞ってある。

```
GitHub Actions
      │ Workload Identity (鍵を置かない認証)
      ▼
Artifact Registry ──▶ Cloud Run (api)  ◀── Secret Manager
  (イメージ置き場)         │  HTTPS は自動で付く
                          │  Cloud SQL コネクタ (Unix ソケット)
                          ▼
                     Cloud SQL (PostgreSQL 16)
                          ▲
                     Cloud Run ジョブ (rails db:apply)

Cloud Run (web, nginx + ビルド済み SPA) ──▶ api を直接叩く
```

| ファイル | 内容 |
| --- | --- |
| `apis.tf` | 使う GCP API の有効化 |
| `registry.tf` | Artifact Registry (コンテナイメージの置き場) |
| `database.tf` | Cloud SQL インスタンス・データベース・ユーザー |
| `secrets.tf` | Secret Manager (`SECRET_KEY_BASE` / JWT 鍵 / DB パスワード) |
| `run.tf` | Cloud Run の api・web と、rails タスクを流すジョブ |
| `github_oidc.tf` | GitHub Actions 用の Workload Identity |
| `bin/*.sh` | 操作スクリプト。`make infra-*` から呼ばれる |

## 初回の手順

```bash
make infra-bootstrap   # 対話: gcloud ログイン -> プロジェクト選択 -> 課金 -> API 有効化
# infra/gcp/terraform.tfvars の github_repository を自分のリポジトリに直す
make infra-apply       # GCP 側にリソースを作る (Cloud SQL の作成に 5〜10 分)
make infra-release     # イメージをビルドして push -> スキーマ適用 -> Cloud Run を更新
make infra-url         # 公開 URL を表示
make infra-seed        # デモユーザーを入れる (任意)
make infra-secrets     # GitHub Secrets を登録して CI/CD を有効化 (任意)
```

`make infra-apply` の直後は Cloud Run が Google のサンプルイメージで動いている。
`make infra-release` で自分のイメージに置き換わる。これは「Cloud Run の URL が
決まらないとフロントのビルドに埋める API URL が決まらない」という順序の問題を、
素直に 2 段階に分けたもの。

## ふだんの操作

| コマンド | 内容 |
| --- | --- |
| `make infra-release` | ビルド -> push -> スキーマ適用 -> Cloud Run 更新 |
| `make infra-url` | 公開 URL |
| `make infra-logs` | Cloud Run (API) のログを追尾 |
| `make infra-db-apply` | `db/Schemafile` を Cloud SQL に適用 |
| `make infra-seed` | `db:seed` |
| `make infra-task T=db:dry_run` | 任意の rails タスクを 1 回流す |
| `make infra-psql` | Cloud SQL に psql で繋ぐ (自分の IP を一時的に許可する) |
| `make infra-plan` | terraform の差分 |
| `make infra-destroy` | 全部削除 (Cloud SQL のデータも消える) |

`main` にマージすると CI の完了後に `.github/workflows/deploy.yml` が同じことをする。

## 知っておくと迷わないこと

**イメージは terraform が管理しない。** `run.tf` の `lifecycle.ignore_changes` で
イメージを除外してある。terraform はインフラの形だけを持ち、どのタグが動いているかは
`gcloud run deploy` 側 (= `make infra-release` と CI) の責任。だから
`make infra-apply` を実行してもデプロイ済みのイメージは巻き戻らない。

**DB への繋ぎ方。** Cloud Run に Cloud SQL コネクタを挿すと
`/cloudsql/<プロジェクト>:<リージョン>:<インスタンス>` に Unix ソケットが生える。
Rails には `DB_HOST` にそのパスを渡すだけでよい (libpq は `/` 始まりの host を
ソケットとして扱う)。VPC もパスワード以外の設定も要らない。

**データベース名。** Rails の production 環境は `DB_NAME` の末尾に `_production` を
付けて接続するので、実際に作られるのは `app_production`。

**スキーマ管理。** マイグレーションではなく ridgepole (`db/Schemafile` が正)。
Cloud Run ジョブで `rails db:apply` を流す。新しいコードを出す前に当たる順番にしてある。

**Sidekiq / Redis は本番に置いていない。** Memorystore はゼロスケールできず、
Serverless VPC コネクタと常時稼働の worker も要るので、月 ¥8,000 前後の固定費に
なってしまう。代わりに production だけ ActiveJob のアダプタを `:inline` にして
(`backend/config/environments/production.rb`)、`perform_later` をリクエスト内で
同期実行している。ローカルの `compose.yaml` は今も redis と worker を立てるので、
開発側は本物の非同期で動く。

今のジョブ (`AnalyzeRoomJob` / `GenerateCoordinationJob`) は外部呼び出しの無い
純粋な計算でミリ秒で終わるので、これで困らない。`status` をポーリングする API 契約も
壊れない (即 `ready` / `done` になるだけ)。

**`RoomAnalyzer` / `CoordinationBuilder` を LLM に差し替えるときは要再検討。**
リクエストが待たされて Cloud Run のタイムアウト (300s) に当たる。移行先の候補:

- **Cloud Tasks** … ゼロスケールのまま本当の非同期になり、タスクの実行時間は最大 30 分。
  月 100 万タスクまで無料。`perform_later` を Cloud Tasks への enqueue に替え、
  OIDC 認証付きで叩かれる実行エンドポイントを足す
- **Memorystore + worker 用 Cloud Run サービス** (`min_instance_count = 1`) …
  Sidekiq のまま動かせるがコストが上がる

**秘密の値。** `SECRET_KEY_BASE` / JWT 鍵 / DB パスワードは terraform が生成して
Secret Manager に入れ、Cloud Run が環境変数として読む。`terraform.tfstate` には
平文で入るのでコミットしない (`.gitignore` 済み)。

## お金

| | 目安 |
| --- | --- |
| Cloud SQL (db-f1-micro, HDD 10GB) | 月 ¥1,500 前後。**アクセスが無くても常に掛かる** |
| Cloud Run (api / web) | アクセスが無い間はゼロに縮むのでほぼ ¥0 |
| Artifact Registry / Secret Manager | 数十円 |

固定費は実質 Cloud SQL だけ。使わない期間は `make infra-destroy` で消すか、
コンソールから Cloud SQL インスタンスを停止する。

`api_max_instances` / `web_max_instances` が暴走時の課金の上限になる。
心配なら GCP コンソールで予算アラートも設定しておく。

## つまずいたとき

**`allUsers` の付与でエラーになる** (`One or more users named in the policy do not belong
to a permitted customer`)
Google Workspace の組織配下のプロジェクトだと、組織ポリシー
`constraints/iam.allowedPolicyMemberDomains` (ドメイン制限共有) が `allUsers` を禁止している。
対処は次のいずれか。

- 組織に属さないプロジェクトを使う (個人の Gmail アカウントで作る) ← ハッカソンならこれが早い
- 組織の管理者にこのプロジェクトだけ例外を設定してもらう
- 公開をやめ、`run.tf` の `*_public` を消して認証付きで叩く

**`gcloud projects create` が権限エラーになる**
組織配下にプロジェクトを作る権限が無い。組織の管理者に作ってもらい、
`make infra-bootstrap` では既存のプロジェクト ID を入力する。

**terraform が `could not find default credentials` と言う**
`gcloud auth login` とは別に、terraform 用の認証情報が必要。

```bash
gcloud auth application-default login
```

**`make infra-apply` が API 有効化の直後に失敗する**
有効化の反映に数十秒かかることがある。もう一度 `make infra-apply` を実行すれば通る。

**最初のアクセスが遅い**
Cloud Run がゼロまで縮んでいるためのコールドスタート。常に温めたいなら
`run.tf` の `min_instance_count` を 1 にする (そのぶん常時課金される)。

**`db:apply` が権限で失敗する**
`app` ユーザーは `cloudsqlsuperuser` のメンバーなので通常は作成できる。
もし落ちたら `make infra-psql` で繋いで
`GRANT ALL ON SCHEMA public TO app;` を実行する。

## 家具GLBの配置

公開モデル用バケットはTerraformの `models_bucket` 出力で確認できます。BlenderでGLBを生成した後、`make infra-models-publish` で台帳と照合してアップロードします。Terraformのローカル設定がない場合は `MODELS_BUCKET=<バケット名> make infra-models-publish` を使います。

`make infra-release` とGitHub Actionsは、スキーマ適用に続けて `furniture_models:import` を実行し、87モデルの台帳と家具・商品の対応をDBへ取り込んでからCloud Runを更新します。APIは既存の `MODELS_BUCKET` から公開URLを作るため、本番への新しい秘密情報の登録は不要です。GLBのアップロードはリリース前に行います。詳しくは[家具モデルの運用](../../docs/furniture-models.md)を参照してください。
