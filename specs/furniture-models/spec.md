# 家具モデルのGCS配信とDB管理

## 目的と出典

2026-10-04の依頼に基づき、フロントに同梱していた3DモデルをGCSで配信し、用途・寸法・保存先をDBで管理する。ユーザーは公開URLでの配信を指定した。バケット名は`zenn-hackathon-takarada-models`と共有された。

Google DocsのURLは`docs/project.md`に未設定のため、Docsは未確認。依頼文、PR #8のGLB・生成スクリプト・対応表、既存の部屋APIを暫定の根拠とする。今回の依頼ではPR #8をGCS配信へ変更する。GCSバケットとCloud Runの構成は、mainにマージ済みのPR #12を利用する。

## 実装で満たす条件

- GLBをWebの配信物に含めず、公開GCS URLから読み込む。
- DBにモデルID、名称、カテゴリ、形状、バリエーション、GLB寸法、保存先、形式、バイト数、ハッシュ、三角形数、素材名を持つ。
- 寸法はメートルで幅・高さ・奥行きを区別し、すべて正の値にする。
- 既存家具ID・商品IDとモデルの対応をDBで管理し、同じ対象への割り当てを一つにする。
- 台帳JSONを再取り込みしても重複せず、検証失敗時は一件も更新しない。
- 公開の一覧・単体APIと、部屋APIの`model_url`でクライアントへ配信情報を渡す。
- バケットURLの変更で台帳の全行を書き換える必要をなくす。
- 配信元未設定・対応なし・無効なモデル・GLB取得失敗では簡易形状を使う。
- Webはカタログの不正な行を除外し、正常な行と簡易形状の描画を維持する。
- 旧ローカルURL`/models/furniture/...`だけをGCSへ置き換え、外部URLと部屋内の寸法・位置・回転を維持する。ダミー接続はオフラインで動く。

## DBと配信の判断

`backend/db/Schemafile`に`furniture_models`と`furniture_model_bindings`を定義する。モデルIDと、対応の種類・参照IDには一意制約を置く。バリエーションはGLBごとに一行とする。`object_key`は`models/furniture/v1/<file>.glb`とする。

公開APIと`ModelResolver`は`FURNITURE_MODEL_BASE_URL`を優先し、未設定なら`MODELS_BUCKET`から`https://storage.googleapis.com/<bucket>`を組み立てる。この配信元へ`object_key`を連結する。両方未設定ならURLを返さない。

GLBの座標は`+Y`が上、`+Z`が正面、底面中心を原点とする。制作時の寸法は書き出し工程で適用する。モデルの寸法と、部屋に置いたときの寸法は別に扱い、GLBを取り込んでもレイアウトは変更しない。

モデルを参照する対象は、既存家具と商品の二種類に分ける。カテゴリから推測して割り当てると形状や色を誤るため、対応IDがない場合は簡易形状を表示する。

2026年10月5日の追加要求では、日本向けECの実商品を用途・形状・寸法から照合し、採用したモデルを商品バリエーションの明示対応として保存する。表示時にカテゴリだけから推測する処理は追加しない。生成するのはテクスチャだけで、元のGLBを共用する。詳細は[EC家具Spec](../ec-furniture/spec.md)を参照する。照合・生成処理は実装済み。`managed_by`で台帳とEC照合の管理元を分け、台帳取り込みはEC照合の対応を維持する。

取り込みの正本は`backend/db/furniture_models.json`。生成ツールはGLBを照合し、メタデータと対応表を出力する。入力から外した対応関係はDBから削除する。入力にないDBのモデルは削除せず、無効化したモデルも再有効化しない。

公開モデル用バケットは`infra/gcp/storage.tf`で`${project_id}-models`として定義済み。`allUsers`の読み取り権限と、すべてのオリジンからの`GET`・`HEAD`を許可するCORSを利用する。部屋写真の非公開バケットとは分ける。署名付きURLやWeb向けのGCP認証情報は発行しない。

`make infra-models-publish`は、`output/furniture_models/furniture/`から台帳に載ったGLBだけを一時ディレクトリへ複製し、検証したファイルを`gs://<bucket>/models/furniture/v1/`へアップロードする。`MODELS_BUCKET`を指定でき、未指定時はTerraformの`models_bucket`出力を使う。デプロイCIと`make infra-release`は、Cloud Runジョブで`db:apply`と`furniture_models:import`を順に実行してからサービスを更新する。

GCS上のファイル一覧を自動収集する処理と管理画面は含めない。運用手順は`docs/furniture-models.md`に記す。

## Google Docsへ未反映の変更

GCS配信、DB台帳、公開カタログAPI、IDによるモデル割り当て、台帳の取り込み、配信元の環境変数を追加した。Google Docsには書き込んでいない。

## 検証と接続の状況

最新mainをPR #8へ統合後、分離した検証用DBで既存RSpec28件すべて成功。RuboCop、Swagger生成、TypeScript型生成、Webのlint・本番ビルド、Composeとshell構文の確認も成功した。新規テストはAPI契約生成に必要な最小rswag定義に限る。Webビルドには既存の大きなJavaScriptチャンクの警告がある。

レビュー修正後もRSpec28件、RuboCop、Webのlint・本番ビルドが成功した。対応関係の削除と空の対応表への同期、旧URLの解除とYAML補完、不正なカタログ行の除外、配信元設定の起動時検証を確認した。公開スクリプトは台帳掲載の87ファイルだけを送信対象とし、材質だけを変更したファイルもハッシュ不一致で送信前に拒否することを確認した。この検証ではGCSへの送信処理を代替し、実際のアップロードは行っていない。

全87GLBの寸法・原点・素材・三角形数・SHA256を照合し、台帳の再生成結果が一致することと、Webの配信物にGLBがないことを確認した。Railsの実行環境では87モデルと40件の対応を取り込み、再実行時の重複防止、公開APIのGCS URL、既存家具と商品のURL解決、配置と外部URLの維持、無効設定と配信元未設定時の扱いを確認した。ジョブは配信URLを永続化せず、API応答時にモデルを解決する。DBの無効化とバケット変更が保存シーンへ反映されることも確認した。確認用DBの変更はトランザクションでロールバック済み。スキーマの再適用差分もない。

ユーザー提供の画像とGoogle Cloudコンソールから、対象バケットは`zenn-hackathon-takarada-models`、projectは`zenn-hackathon-takarada`と確認した。ユーザーの公開アップロード承認後、87個のGLB、合計8,114,712バイトを`models/furniture/v1/`へ配置。全ファイルの認証なし取得、CORS、MIME、サイズ、SHA256一致を確認した。本番APIの`MODELS_BUCKET`も同じバケット名である。本番DB反映、マージ、デプロイは未実施。
