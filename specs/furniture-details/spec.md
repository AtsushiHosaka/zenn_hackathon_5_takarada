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
furnitures              名前・種類・有効か。DBが正 (管理APIで登録)。db/furnitures.json は空のDBへの初期データ
  ├─ furniture_3d_models  3Dモデル (家具 1 : 1。Furniture#model)。model_key・形・寸法・部位・推定した辺。家具と一緒に登録する
  └─ furniture_details    色・寸法・素材・価格(税込の参考価格)・店・URL・画像・テーマ。db/furniture_details.json → rails furniture_detail:import
```

- どちらもDBが正。両JSONは空のDBへ入れる初期データで、各取り込みは空のときだけ入れる（`FORCE=1`でJSONから作り直す）。先に`furniture:import`が必要。
- デプロイ・`compose`・`make furniture-import`・seedは両タスクを順に流す。
- 色はdetailに2つ持つ。`symbolic_color`は代表色（モデルがないときの表示・色での検索・AIへの商品情報）、`color_materials`は部位ごとの色（`{"tint": "#123682", "wood": "#714248"}`）。キーは家具の`color_material_keys`（GLBの素材名）に限り、書いていない部位はモデルの色のまま。
- 3Dは`color_materials`のとおりに部位を塗る。画面で色を変えた家具は、主な部位（`Furniture#primary_color_key`）をその色にする。
- 模様（質感の画像）は静的に用意する。`furniture_textures`（`texture_key`・名前・タイルの大きさ・`tinted`）を`db/furniture_textures.json`から入れる。画像は`MODELS_BUCKET`の`textures/v1/<texture_key>.png`。
- detailの部位ごとの模様は`furniture_detail_textures`（detail 1 : 0〜n、部位ごとに1つ）。`furniture_details.json`の`texture_materials`（`{"tint": "linen"}`）から作る。部位は家具の`color_material_keys`に限る。
- 表示では模様に部位の色を掛ける。`tinted: false`（柄物）は色を掛けず、画像の色のまま。模様は2026-10-10時点で0件（色だけ）。
- 提案ごとの画像生成（Gemini画像生成・`FurnitureTextureGenerator`）と、生成画像を開発環境で配信するAPIは削除した。旧`furniture_textures`の行（生成画像の記録）は、リリース時に`furniture_texture:clear_legacy`が`db:apply`の前に消す。GCSの生成画像と、保存済みシーンの画像URLは残る。
- 商品からモデルを寸法比で推定する照合（`FurnitureProductMatcher`）は削除した。
- 写真の家具の照合（`FurnitureModelMatcher`・`existing`の対応）は`furnitures`を引くだけで、ロジックは変えていない。
- 写真の家具・古いコーデの商品とモデルの対応表（`furniture_bindings`）は持たない。シーンのモデルは`FurnitureModelMatcher`が、同じカテゴリで寸法比が一番近いモデルを付ける。2026-10-10時点で、写真の家具3件は対応表と同じモデルになり、本番の保存済みコーデで対応表に頼る商品は0件だった。
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

- 実EC検索のコード（検索・ページ取得・HTML解析・商品画像の色抽出・`RealClient`・`MockClient`・`interior_links_mock.yml`）と関連の環境変数（`EC_PROVIDER`・`EC_SEARCH_MODEL`・`EC_EXTRACTION_MODEL`）を削除した。カテゴリ判定規則と色名は`InteriorLinks::ProductCategories`・`ProductColors`に残す。
- 追加・入れ替えで候補がないとき、そのカテゴリが未登録なら「まだ登録されていない」と断る（予算・配置の都合と区別する）。

## 商品の項目の整理（2026-10-11）

2026-10-11のユーザー依頼（チャット）「いらないものは全部消し、最低限だけ入れたい」「種類と形は商品ではなく家具の側で持つほうがよい」を根拠とする。Docsは未確認・未反映。

- `furniture_details.metadata`（jsonb）と`checked_at`を削除した。商品に足した列は`material`（主な素材。短い値。AIへの商品情報）だけ。
- 寸法のうち推定した辺（`estimated_axes`）は、商品ではなく`furniture_3d_models`に持つ（ユーザー指定。「furniture detailに入れない」）。それ以外の辺が公開されている寸法（`FurnitureDetail#published_size`）。
  - 同じモデルの商品で推定した辺が違う場合（商品が2件以上あるモデル15個のうち8個）は、どれかの商品で推定の辺をそのモデルの推定とした。このため15件の商品で、公開されている寸法の一部が公開寸法として表示されなくなる（例: POÄNG・ニトリのラグは3辺とも）。置き方が変わる商品は0件。
  - 3Dモデルは DB が正（#125）。値は DB の`furniture_3d_models.estimated_axes`が持ち、初期データ`db/furnitures.json`と書き出し（`FurnitureExporter`）にも同じ項目を出す。GLB の公開（`publish.py`）はこの項目を送らないので、登録し直しても値は変わらない。管理画面では変えられない。
- 削除した項目：`provider`、`official_color`、`metadata.color_name`（色名は`color_name`列だけ）、`metadata.size`（寸法の列と`estimated_axes`で表す）、`metadata.shape`。
- 形は商品に持たせず、家具の3Dモデルの`shape`（`chair_office`・`stool_round`・`rug_round`など）を使う。同じモデルの商品は同じ形になるので、商品ごとに持つと重複する。椅子の種類（デスク用・スツールなど）も、モデルの形で分かるので別の列は作らない。
- シーン・提案に載せる`product_metadata`は商品の列と家具の3Dモデル（形・推定した辺）から組み立てる（`FurnitureDetail#product_metadata`）。`shape`には3Dモデルの形の名前が入る。保存済みのシーンには旧い項目が残るので、API定義の`ProductMetadata`と画面の読み取りは変えていない。
- カーテン・ベッドカバーを実寸で置くかどうかは、`provider`の有無ではなく「公開されている寸法が1辺でもあるか」で決める。3辺とも推定の商品は、従来どおり窓・ベッドに合わせた大きさで置く。手入力の32件が使うモデルは3辺とも推定にしたので、既存92件の置き方は変わらない。
- 候補は3Dモデルの形ごとに1件ずつ順に取る（`FurnitureCandidates.spread`）。椅子30件は価格の安い順に並んでいて、先頭12件だけだとデスク用・くつろぎ用の椅子がAIの候補に入らなかったため。椅子の候補12件は12種類の形になる。
- AIへの商品情報に3Dモデルの`shape`と`themes`を足した。`themes`は今までモックの絞り込みにしか使っていなかった。
- 既存のDBは、リリース時に`furniture_detail:migrate_fields`が`db:apply`の前に移す（`metadata`列があるときだけ動く）。色名は`metadata`から、短い素材は`db/furniture_details.json`を`key`で引いて入れる。3Dモデルの推定した辺も、このタスクが`db/furnitures.json`をモデルIDで引いて入れる（`furniture:import`は家具が1件でもあれば何もしないため）。
- 未対応：値の誤り（ÄNGSLILJA ライトブラウンの高さ2m、EKTORPの寸法、紫の商品の代表色など）、参考モック3件、手入力32件の素材・色名、ソファ・ベッド・机の商品追加。
- 未検証：管理画面の編集欄のブラウザでの操作、本番DBでの移し替え。手元では旧い形のDBの複製で移し替えを実行し、旧データと照合した。

## 雰囲気のタグと検索語の解釈（2026-10-11）

2026-10-11のユーザー依頼（チャット）「雰囲気タグを足したい」「検索語をLLMで解釈したい」と、その場での選択（タグは10個で始める、AIが商品画像を見て下書き、家具検索をAIで解釈）を根拠とする。Docsは未確認・未反映。

- 雰囲気のタグは`furniture_details.themes`に持つ（新しい列は足さない）。同じ3Dモデルでも色・柄で雰囲気が変わるので、家具ではなく商品に持たせる。
- 選べるタグは`FurnitureCandidates::THEMES`の10個：シンプル・ナチュラル・北欧・韓国風・かわいい・モダン・アンティーク・和風・ボタニカル・推し活。一覧にない値は保存できない。旧い`oshi_purple`は`oshi`にした。
- 初期データ92件のタグは、Geminiに商品画像（88件。画像のない4件は名前だけ）と名前・色・素材・形を見せて下書きし、以前のテーマと合わせた。件数はシンプル67・北欧30・ナチュラル30・モダン27・推し活20・韓国風16・ボタニカル14・かわいい7で、アンティークと和風は0件。人の目では確認していない。
- 既存のDBは、リリース時に`furniture_detail:retag_themes`が付け直す（一覧にないタグが残っているときだけ動く。2回目以降は何もしない）。
- AIへの商品情報の`themes`は日本語の名前で渡す。管理画面はチェック欄で選ぶ。
- 家具検索は検索語から形・色・雰囲気を読み取る（`FurnitureQuery`）。種類・色・雰囲気の言葉だけなら規則で読み、ほかの言葉が残るとき（「くつろげる椅子」「丸いラグ」）だけGeminiを1回呼ぶ（手元で1.4〜2.5秒）。Geminiが使えないときは規則で読めた分だけを使う。
- 読み取った形の商品は種類が違っても候補に入れ、形と雰囲気が合う商品を上に並べる。画面で選んだ種類・色があれば、そちらを優先する。APIの形は変えていない（`color`には、指定がなければ読み取った色が入る）。
- 色の絞り込みは、色名と商品名の両方を見る（色名が「ライラック」で商品名が「パープル」の商品が漏れていた）。紫の言葉に「ライラック」を足した。
- 提案の候補は、要望文から読み取った色・雰囲気・形に合う商品を先にする（2026-10-11のユーザー依頼「要望やタグに合う商品ごとに並べ替えてAIに渡したい」）。`CoordinationBuilder`が`FurnitureQuery`で要望文を読み、`FurnitureCandidates.score`（色が合えば2、タグ1つにつき1、形が合えば1）の高い順に並べてから、3Dモデルの形ごとに12件を取る。同点は並び順のまま。読み取った結果は`coordinations.analysis`の`preference`に残す。
- 並べ替えはGeminiを使う経路だけで、提案1回につきGeminiの呼び出しが1回増える（手元で1.3〜2.4秒）。読み取りに失敗したときは規則で読めた分だけを使う。モックは並び順のまま。
- 未検証：管理画面のチェック欄と家具検索のブラウザでの操作、本番DBでの付け直し。

## 未対応・未検証

- ローカル（Geminiなし・モックのプランナー）で、テーマ提案・椅子の追加・棚の入れ替え・選んだdetailでの入れ替え・カテゴリ違いの拒否を確認した。Geminiのプランナー、本番データ、Web/iOSの実画面では未確認。
- iOSは家具検索・取り込みのAPIを使っていないため変更していない。
