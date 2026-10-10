# 家具モデルをGCSで配信し、DBで管理する

家具のGLBは公開GCSバケットへ置き、モデルの情報はRailsのDBへ取り込む。Webは部屋APIが返す`model_url`からGLBを直接読む。モデルを更新する開発者向けに、初回の配置手順と更新方法を記す。

## DBには寸法と用途、GCSの保存先を持つ

`furniture_models`にモデルごとの情報を保存する。

| 項目 | 意味 |
| --- | --- |
| `key`、`name` | 安定したモデルIDと表示名 |
| `category`、`shape`、`variant` | 家具の分類、形状、色やサイズのバリエーション |
| `object_key` | バケット内の相対パス。例：`models/furniture/v1/bed_single.glb` |
| `width`、`height`、`depth` | GLBの幅・高さ・奥行き。単位はメートル |
| `format`、`byte_size`、`sha256` | ファイル形式、バイト数、内容の照合に使うハッシュ |
| `triangle_count`、`materials` | 三角形の数と素材名 |
| `enabled` | 配信対象かどうか。無効ならURLを返さない |

座標は`+Y`が上、`+Z`が正面、原点は底面中心で統一する。モデルの寸法と、部屋のシーンに保存した配置寸法は別に扱う。ローダーは配置寸法の範囲に収まるようモデル全体を拡縮する。

`furniture_model_bindings`でモデルと利用対象を結び付ける。`kind=existing`は既存家具のID、`kind=product`は商品IDを指す。同じ種類とIDの組み合わせにはモデルを一つだけ割り当てる。

対応表に無い家具・商品は、カテゴリから推測して割り当てる (2026-10-05 方針変更。それまでは推測しなかった)。写真の解析 (Gemini) では`chair-1`・`shelf-2`などのIDが出て対応表に載らず、DBにモデルがあっても簡易形状になっていたため。推測の規則は次のとおり。

- 対応表 (`existing`のID・`product`の商品ID) が常に優先する。推測は対応表で見つからないものだけに使う。
- シーンの`category`と、モデルの`category`か`shape`が一致するもののうち、幅・高さ・奥行きの比率のずれ (倍率の対数の絶対値の合計) が一番小さいモデルを選ぶ。例: 幅1.3mのソファは`sofa_2seat__w130`、高さ0.1mのベッドは`futon_floor`、`wardrobe`は`storage`カテゴリの`wardrobe`。
- 一致するモデルが無ければ割り当てず、簡易形状のままにする。
- 実装は`FurnitureModelCatalog.fill_by_category`。

## 生成したGLBを公開バケットへ置く

既存GLBは`output/furniture_models/furniture/`へ移してある。このディレクトリはGit管理外で、Webの配信物には含めない。新しいチェックアウトでGLBが必要な場合は、Blenderで生成する。

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b \
  --python tools/furniture_models/build.py
python3 tools/furniture_models/manifest.py
```

生成したJSONは`backend/db/furnitures.json`に保存する。モデル定義やGLBを変更したときは、このJSONも更新して変更に含める。

GCPにログイン済みの環境で、生成済みのGLBをアップロードする。`infra/gcp/bin/models-publish.sh`は台帳に載ったGLBだけを一時ディレクトリへ複製し、その内容を検証して`gs://<bucket>/models/furniture/v1/`へ配置する。生成先に余分なGLBがあっても公開しない。バケット名は`MODELS_BUCKET`、未設定ならTerraformの`models_bucket`出力から取得する。

```bash
make infra-models-publish

# Terraform出力を使わず、既存バケットを指定する場合
MODELS_BUCKET=BUCKET_NAME make infra-models-publish
```

公開モデル用のバケットは`infra/gcp/storage.tf`で定義する。名前は`${project_id}-models`で、`allUsers`に読み取り権限を付与する。ブラウザ向けの公開URLには`https://storage.googleapis.com/BUCKET_NAME`を使う。部屋写真用の非公開バケットへGLBを置かない。

TerraformのCORS設定は、すべてのオリジンからの`GET`と`HEAD`を許可する。既存バケットを使う場合も、公開読み取り権限とCORSを確認する。設定ファイルに記載されていても、実環境への適用確認が済むまでは公開配信済みとは扱わない。

## 配信元URLを設定する

Cloud RunではTerraformが`MODELS_BUCKET`を設定する。APIは`FURNITURE_MODEL_BASE_URL`を優先し、未設定なら`MODELS_BUCKET`から公開URLを組み立てる。ローカルのDocker Composeではリポジトリ直下の`.env`にどちらかを設定する。

```dotenv
FURNITURE_MODEL_BASE_URL=https://storage.googleapis.com/BUCKET_NAME

# 配信元URLを省略し、バケット名だけを指定してもよい
MODELS_BUCKET=BUCKET_NAME
```

配信元URLには`object_key`を連結するため、末尾に`models/furniture/v1/`を付けない。URLはHTTPSに限り、認証情報・クエリ・フラグメントは付けない。`gs://`やGoogle CloudコンソールのURLは設定しない。どちらも未設定なら`model_url`は`null`になり、Webは簡易形状を表示する。GCPの秘密鍵をWebへ渡す必要はない。

ローカルで環境変数を変更した後は、既存のAPIとworkerへ反映する。

```bash
docker compose up -d --no-deps api worker
```

本番ではモデルのアップロード後に`make infra-release`、またはmainのデプロイCIで反映する。GCSへのアップロードはデプロイと別の操作で、CIがGLBを生成・配置することはない。

## DBへの取り込みは繰り返し実行できる

ローカルの起動時はseedで台帳を取り込む。稼働中の開発コンテナには、スキーマを適用してから取り込む。

```bash
make db-dry-run
make db-apply
make furniture-models-import
```

本番ではデプロイCIと`make infra-release`が、Cloud Runジョブで`db:apply`・`furniture:import`・`furniture_detail:import`を順に実行する。その後、APIとWebのサービスを新しいイメージへ更新する。

取り込みはJSON全体を検証してからトランザクション内で更新する。同じモデルIDや対応IDを再取り込みしても行は増えない。入力から外した対応関係はDBから削除する。入力にないモデルは削除せず、手動で無効にしたモデルは無効のまま保つ。

DBの一覧は公開API`GET /api/v1/furniture_models`、単体は`GET /api/v1/furniture_models/{id}`で取得する。`{id}`には`bed_single`などのモデルIDを指定する。API契約は[Swaggerの生成元](../backend/spec/swagger_helper.rb)で管理する。

部屋APIは保存済みのシーンにもDBの対応関係を適用してURLを補う。旧フロント同梱用の`/models/furniture/...`だけをGCSのURLへ置き換え、外部URLと保存した寸法・位置・回転は維持する。WebもAPI接続時には台帳から不足URLを補い、ダミー接続では通信せず簡易形状を表示する。

旧ローカルURLに対応するモデルがなければ、そのURLを解除してYAML補完か簡易形状へ戻す。Webは取得したカタログを検証し、不正な行を除外する。正常なモデルは表示に使い続ける。

Webが取得した台帳はブラウザのセッション中にキャッシュする。DBの更新や配信元URLの設定後は、ページを再読み込みして反映する。変更前に保存した提案に商品IDがない場合は、簡易形状のまま表示する。

## 更新時はファイルと台帳をそろえる

GLBを生成して台帳JSONを更新し、GCSへアップロードしてからDBへ取り込む。同じパスのファイルを置き換えると最大1時間キャッシュされる設定なので、即時に切り替えたい更新では新しいファイル名と`object_key`を使う。旧オブジェクトを参照する保存シーンがある場合は、旧ファイルも残す。

アップロード済みファイルを自動で列挙したり、用途を推定したりする仕組みは含めない。外部制作モデルを追加する場合も、用途・寸法・保存先をJSONへ記入して取り込む。ブラウザで読めない場合は、公開権限、CORS、`object_key`、APIの`model_url`を確認する。

アップロード先は`zenn-hackathon-takarada-models`。2026-10-04にユーザーの承認後、87個のGLBを`models/furniture/v1/`へ配置した。全ファイルを認証なしで取得し、CORS、MIME、バイト数、SHA256が台帳と一致することを確認した。本番APIの`MODELS_BUCKET`も同じバケット名だった。今回のコードの本番DB反映、マージ、デプロイは未実施。

2026-10-04から05にかけて172モデルを追加し、台帳は259モデルになった。2026-10-05にユーザーの承認後、`make infra-models-publish`で259ファイルを`models/furniture/v1/`へ配置した（既存87ファイルは同一内容で上書き）。全ファイルを認証なしで取得し、SHA256・バイト数・MIME・CORSが台帳と一致することを確認した。本番DBへの反映はマージ後のデプロイで行う。
