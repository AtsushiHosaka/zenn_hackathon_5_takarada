# infra (AWS Lightsail + API Gateway)

Lightsail インスタンス 1 台の上で `docker compose`(api + PostgreSQL)を**本番モード**で動かし、
その前に API Gateway を置いて HTTPS で公開する。DB もコンテナなので、外部の
マネージド DB は使わない。

```
GitHub (main) ──> Actions ──build/push──> ECR
                                           │ pull
ブラウザ ──https──> API Gateway ──http──> Lightsail (docker compose: api + db)
```

アプリはコンテナイメージとして ECR 経由で届く。インスタンスにソースは置かない。

## 使い方

```bash
# 1. AWS の認証情報を用意 (どちらでもよい)
aws configure                        # ~/.aws/credentials を作る
export AWS_PROFILE=your-profile      # すでにあるなら

# 2. 設定 (既定値のままでも動く)
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars

# 3. 作成 + デプロイ
make infra-up
```

`make infra-up` が終わると `https://xxxx.execute-api.ap-northeast-1.amazonaws.com` が表示される。

| コマンド | 内容 |
| --- | --- |
| `make infra-apply` | AWS リソースを作成し、接続情報を `infra/.env` に書き出す |
| `make infra-push` | backend のイメージをビルドして ECR に push |
| `make infra-deploy` | インスタンスに ECR から pull させて入れ替え |
| `make infra-release` | push + deploy |
| `make infra-up` | apply + push + deploy(初回はこれ) |
| `make infra-secrets` | terraform の出力を GitHub Secrets に登録(CI/CD を有効化) |
| `make infra-plan` | AWS 側に作られる差分を確認 |
| `make infra-url` | 公開 URL を表示 |
| `make infra-ssh` | インスタンスに入る |
| `make infra-console` | インスタンス上で `rails console`(プロンプトは `irb(prod)`) |
| `make infra-seed` | デモユーザーを投入する(既定では入らない) |
| `make infra-logs` | インスタンス上の api コンテナのログ |
| `make infra-destroy` | 作ったものを全部削除 |

コードを直したら `make infra-release`。main にマージすれば GitHub Actions が同じことをする。

## 構成

```
terraform/
  lightsail.tf                # インスタンス / 固定IP / ファイアウォール / SSH鍵
  ecr.tf                      # イメージのリポジトリ + pull 用 IAM ユーザー
  github_oidc.tf              # Actions が ECR に push するための IAM ロール
  apigateway.tf               # HTTP API + HTTP_PROXY 統合 + $default ステージ
  secrets.tf                  # SECRET_KEY_BASE / JWT 署名鍵の生成
  variables.tf / outputs.tf
  terraform.tfvars.example
compose.deploy.yaml           # 本番モードで動かすオーバーレイ (ECR のイメージを使う)
bin/tf.sh                     # terraform をコンテナで実行するラッパー
bin/aws.sh                    # AWS CLI をコンテナで実行するラッパー
bin/apply.sh                  # terraform apply -> infra/.env 書き出し
bin/push.sh                   # buildx でビルドして ECR に push
bin/deploy.sh                 # compose ファイルを置いて pull -> up
bin/github-secrets.sh         # GitHub Secrets を登録
```

compose は 3 枚重ね。

| ファイル | 用途 |
| --- | --- |
| `compose.yaml` | ベース。`image:` でイメージを指定する |
| `compose.override.yaml` | ローカル専用。`build` とコードのバインドマウントと seed を足す(自動で読まれる) |
| `infra/compose.deploy.yaml` | デプロイ用。ECR のイメージ + 本番モード。`-f` で明示するので override は読まれない |

Terraform はホストにインストール不要で、`hashicorp/terraform` イメージを docker run して使う。
AWS の認証情報は `~/.aws` と `AWS_*` 環境変数の両方から引き継ぐ。

## 作られるもの

| リソース | 用途 |
| --- | --- |
| `aws_lightsail_instance` | Ubuntu 24.04。user_data が Docker を入れる |
| `aws_lightsail_static_ip` | 再起動しても IP が変わらないように |
| `aws_lightsail_instance_public_ports` | 22(SSH)と 3000(API)を開ける |
| `aws_lightsail_key_pair` | 秘密鍵は `infra/.ssh/<project>.pem` に書き出される |
| `aws_apigatewayv2_api` + 統合 + ルート | `ANY /` と `ANY /{proxy+}` を Lightsail に転送 |
| `aws_ecr_repository` | イメージの置き場。直近 10 個だけ残す lifecycle 付き |
| `aws_iam_user` (ecr-puller) | **Lightsail は IAM ロールを持てない**ので、pull 専用ユーザーの鍵をインスタンスに渡す |
| `aws_iam_role` (github-actions) | Actions が OIDC で引き受ける。ECR への push のみ許可、main からのみ |

既定は `ap-northeast-1` / `small_3_0`(2GB)。プランは `terraform.tfvars` で変えられる。
Rails + PostgreSQL + `docker build` を同居させるので 1GB だと足りない。

## 直接アクセスを塞ぐ

API Gateway に固定 IP が無いため、Lightsail の 3000 番は全公開せざるを得ない。
つまり **API Gateway を経由せずに IP を直接叩ける**。

`terraform.tfvars` に `origin_secret` を入れると塞げる。

```hcl
origin_secret = "<openssl rand -hex 32 の出力>"
```

- API Gateway が全リクエストに `x-origin-secret` ヘッダを付与する
- インスタンス側は `ORIGIN_SECRET` 環境変数で同じ値を受け取り、
  `backend/lib/middleware/origin_guard.rb` が一致しないリクエストを 403 で弾く
- 値が空なら何もしない(ローカル開発では常に無効)

## イメージ

- **x86_64 でビルドすること。** Lightsail は x86_64 なので、Apple Silicon から `make infra-push`
  する場合は `--platform linux/amd64` でクロスビルドしている(`IMAGE_PLATFORM` で変更可)。
- タグは `latest` と、CI ではコミット SHA。インスタンスは `infra/.env` の `API_IMAGE` を見る。
- **ロールバック**は `infra/.env` の `API_IMAGE` を戻したいタグに書き換えて `make infra-deploy`。

## 本番モード

`compose.deploy.yaml` が `RAILS_ENV=production` を渡すので、インスタンス上では本番モードで動く
(ローカルの `docker compose up` は development のまま)。

- `SECRET_KEY_BASE` と `DEVISE_JWT_SECRET_KEY` は terraform が生成し、`infra/.env` 経由で渡す。
  `terraform.tfvars` で固定値を指定すれば上書きできる。値を変えると発行済みの JWT は全部無効になる。
- `production.rb` が `assume_ssl = true` / `force_ssl = true`。TLS は API Gateway が終端し、
  Rails は SSL 済みとして扱うのでリダイレクトループにはならない。
- **seed は流れない**。起動時は `db:create db:apply` までで、デモユーザー(パスワード `password`)を
  公開環境に作らないようにしてある。欲しければ `make infra-seed`。
- ログは STDOUT。`make infra-logs` で見る。レベルは `RAILS_LOG_LEVEL` で変えられる。
- `rails console` のプロンプトは `irb(prod):001 > `(赤)。ローカルは `irb(dev):001 > `(青)。
- インスタンスにソースは無い。`make infra-console` や `make infra-seed` はイメージの中で動く。

## 注意点

- **Rails の Host 認可**: production では `config.hosts` が空なので Host チェックは行われない。
  絞りたい場合は `config/environments/production.rb` の `config.hosts` を有効にする。
- **データはインスタンスの中**: PostgreSQL は compose のボリューム。
  `make infra-destroy` でインスタンスごと消えるとデータも消える。バックアップは取っていない。
- **秘密情報**: `infra/.env`、`infra/.ssh/`、`terraform.tfstate`、`terraform.tfvars` は
  `.gitignore` 済み。**state に SSH 秘密鍵・origin_secret・SECRET_KEY_BASE が平文で入る**ので共有しない。
  チームで共有するなら S3 のリモート backend を設定する。
- **SSH の範囲**: 既定では 22 番が全公開。`ssh_allowed_cidrs` を自分の IP に絞ると安全。
- **費用**: `small_3_0` は月 $12 程度 + 固定 IP(インスタンスに紐付いていれば無料)。
  API Gateway は HTTP API のリクエスト課金。使い終わったら `make infra-destroy`。
