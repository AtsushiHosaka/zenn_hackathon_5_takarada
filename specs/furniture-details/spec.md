# 家具と色・寸法・購入リンクをDBで持つ

ECサイトの自動検索をいったん止め、DBに登録した家具だけでコーデ提案・家具検索を行う。

## 根拠

2026-10-10のユーザー依頼（チャット）を根拠とする。Google Docs URLは`docs/project.md`に未設定で、Docsは未確認・未反映。

- 「ECサイトのリンク自動検索いったんやめてDBに保存されているものを使う」
- 「1家具 - 1 3Dモデル - 多リンク」。リンク先の商品と3Dモデルは十分似ている前提で、リンクを別テーブルに分けない。
- 構造は`Furniture`（3Dモデル）と`FurnitureDetail`（色・寸法・リンク）。`furniture_models`は`furnitures`に置き換える。
- 商品URLを貼って所有家具を取り込む機能（`furniture_imports`）も止める。
- 既存データはJSONにまとめ、Rakeタスクで新テーブルへ反映する。床置き家具は本番DBで取得済みの商品から移す。

## データ

```
furnitures              名前・種類・有効か。db/furnitures.json → rails furniture:import
  ├─ furniture_3d_models  3Dモデル (家具 1 : 1。Furniture#model)。model_key・形・寸法・部位。同じJSONから取り込む
  └─ furniture_details    色・寸法・価格(税込の参考価格)・店・URL・画像・テーマ。db/furniture_details.json → rails furniture_detail:import
```

- 両JSONを正とする。`furniture_detail:import`はJSONにないdetailを消す。先に`furniture:import`が必要。
- デプロイ・`compose`・`make furniture-import`・seedは両タスクを順に流す。
- 色はdetailに2つ持つ。`symbolic_color`は代表色（モデルがないときの表示・色での検索・AIへの商品情報）、`color_materials`は部位ごとの色（`{"tint": "#123682", "wood": "#714248"}`）。キーは家具の`color_material_keys`（GLBの素材名）に限り、書いていない部位はモデルの色のまま。
- 3Dは`color_materials`のとおりに部位を塗る。画面で色を変えた家具は、主な部位（`Furniture#primary_color_key`）をその色にする。
- 模様（質感の画像）は静的に用意する。`furniture_textures`（`texture_key`・名前・タイルの大きさ・`tinted`）を`db/furniture_textures.json`から入れる。画像は`MODELS_BUCKET`の`textures/v1/<texture_key>.png`。
- detailの部位ごとの模様は`furniture_detail_textures`（detail 1 : 0〜n、部位ごとに1つ）。`furniture_details.json`の`texture_materials`（`{"tint": "linen"}`）から作る。部位は家具の`color_material_keys`に限る。
- 表示では模様に部位の色を掛ける。`tinted: false`（柄物）は色を掛けず、画像の色のまま。模様は2026-10-10時点で0件（色だけ）。
- 提案ごとの画像生成（Gemini画像生成・`FurnitureTextureGenerator`）と、生成画像を開発環境で配信するAPIは削除した。旧`furniture_textures`の行（生成画像の記録）は、リリース時に`furniture_texture:clear_legacy`が`db:apply`の前に消す。GCSの生成画像と、保存済みシーンの画像URLは残る。
- 商品からモデルを寸法比で推定する照合（`FurnitureProductMatcher`）は削除した。
- 写真の家具の照合（`SceneModelResolver`・`existing`の対応）は`furnitures`を引くだけで、ロジックは変えていない。
- 写真の家具・古いコーデの商品とモデルの対応表（`furniture_bindings`）は持たない。シーンのモデルは`SceneModelResolver`が、同じカテゴリで寸法比が一番近いモデルを付ける。2026-10-10時点で、写真の家具3件は対応表と同じモデルになり、本番の保存済みコーデで対応表に頼る商品は0件だった。
- 旧`furniture_models`・`furniture_model_bindings`・`ec_products`はSchemafileから削除した。`db:apply`・`db:dry_run`は`--drop-table`付きになり、Schemafileにないテーブルを削除する。
- 削除前の2026-10-10に、Cloud SQLのオンデマンドバックアップ（ID `1791628305175`）を取得した。旧3テーブルの`pg_dump`も作業者のローカル（`backend/tmp/backups/`、git管理外）に保存した。
- 移行は`backend/script/export_legacy_furniture_details.rb`で行った。旧テーブルを読み取り専用で読み、`db/furniture_details.json`へ書く。2026-10-10の本番に対して、73件中60件を反映・13件を除外し、未割り当ては0件。結果はコミット済みのJSONと一致した。
- 本番のモデル台帳259件は`db/furnitures.json`と一致した。本番だけにあった自動照合の対応7件（`ec_matcher`）は移していない。保存済みコーデでモデルURLが空のEC商品は、すべて照合なし（`unmatched`）で、対応表を参照しないため。
- `/api/v1/furniture_models`のパスと応答の形は変えていない（中身は`furnitures`）。

## 初期データ（`db/furniture_details.json`、92件・家具57件）

- 手入力の静的カタログ（旧`config/interior_links_mock.yml`）37件。テーマと並び順を保つ。URLのない参考モック3件は、検索リンクをURLにしている。
- 本番`ec_products`（2026-10-10時点で73件。読み取りのみ）から60件。同じURLの静的行5件は統合した。
- 除外した13件：自動検索でのカテゴリ誤り（ペンダントランプ→カーテン/タペストリー/フロアランプ、マットレスプロテクター→ベッド、デスクチェア→デスク、ランプシェード→ベッドカバー、パズルマット→ラグ、飾り棚→タペストリー）、奥行きが幅と同値の壁棚3件。
- モデルは静的行では従来の対応表、本番分では照合結果を使う。照合が外れた16件と、似ていないモデルが付いた椅子などは、商品名を見て手で割り当てた。
- 床置きの家具は椅子30件・棚1件・テーブル1件だけ。**ソファ・ベッド・机はdetailがなく、追加・入れ替えでは候補0件**になる。
- 生成に使ったスクリプトは本番ダンプに依存するため、コミットしていない。

## API・挙動の変更

- `ec_product_id` / `replacement_ec_product_id` → `furniture_detail_id` / `replacement_furniture_detail_id`（SceneObject・FurnitureEdit）。
- `POST /furniture_searches`はDB検索。商品名の一致を優先し、一致がなければ推定カテゴリ（なければ床置き）全体を返す。家具ごとに1件で、同じ家具のdetailを`variants`で返す。`failures`・`search_entry_points`は削除。
- `POST /furniture_imports`は削除。
- `Coordination.product_source`に`db`を追加。`ec`・`mock`は過去の提案用。
- Geminiの説明文によるテクスチャ生成は、ECで確認した商品（metadataに`provider`がある）だけに行う。手入力の行は色の上書きのみ。

- 実EC検索のコード（検索・ページ取得・HTML解析・商品画像の色抽出・`RealClient`・`MockClient`・`interior_links_mock.yml`）と関連の環境変数（`EC_PROVIDER`・`EC_SEARCH_MODEL`・`EC_EXTRACTION_MODEL`）を削除した。カテゴリ判定規則と色名は`InteriorLinks::ProductCategories`・`ProductColors`に残す。
- 追加・入れ替えで候補がないとき、そのカテゴリが未登録なら「まだ登録されていない」と断る（予算・配置の都合と区別する）。

## 未対応・未検証

- ローカル（Geminiなし・モックのプランナー）で、テーマ提案・椅子の追加・棚の入れ替え・選んだdetailでの入れ替え・カテゴリ違いの拒否を確認した。Geminiのプランナー、本番データ、Web/iOSの実画面では未確認。
- iOSは家具検索・取り込みのAPIを使っていないため変更していない。
