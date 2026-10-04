# frontend

AIルームコーディネーターのPC向けWebフロントです。1440×900をデザインの基準とし、PCウィンドウの幅・高さに合わせて表示を調整します。React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query + React Routerを使います。

```bash
# リポジトリ直下で (backend ごと立つ)
make up            # => http://localhost:5173

# ホストのnodeで動かす場合はfrontend/で実行
npm install
npm run dev
```

開発時の既定はオフラインモック接続です。backendを起動せず、畳数と部屋の形からベッド・デスク・本棚を置いた部屋を表示できます。API接続では、部屋解析と商品提案の2段階のモックAPIを使います。写真解析・AI生成・3Dモデル生成は未接続です。商品価格は参考値、購入先は楽天市場やAmazonの商品検索です。本番ビルドは常にAPIへ接続します。

## 提供されたHTMLを画面の基準にする

ユーザー提供の `AI Room Coordinator.html` と `AI Room Coordinator-png` の6画面を基準に、ログイン、新規登録、ルーム一覧、新規入力、生成中、結果画面を実装しています。HTMLの配色・配置・文字サイズを反映し、Zen Kaku Gothic NewとBricolage Grotesqueのフォント、元のSVGを使用します。以前の独自配色やサイドバー、予算スライダーは使用しません。

チャット・3D・商品パネルは横に並べ、チャットと右側パネルの幅をウィンドウに合わせて調整します。高さが低い場合はチャットやパネルの内側をスクロールできます。最低幅1280pxの固定は外し、1000×720、1272×812、1440×900のPC画面で横にはみ出さないことを確認しています。認証画面も左右の構成を維持し、ルーム一覧は幅に応じて列数を減らします。

| URL | 画面 |
| --- | --- |
| `/` | `/rooms/sample-oshi` の結果サンプルへ移動 |
| `/rooms` | ルーム一覧・検索 |
| `/rooms/new` | 畳数・部屋の形を入力して解析。商品提案API接続では活かす家具を選び、希望・予算を入力 |
| `/rooms/:id` | ルームの結果、生成中の表示、追加の指示 |
| `/coordinate` | `/rooms/new` へ移動 |
| `/login` | ログイン |
| `/signup` | 新規登録 |

結果画面は初期表示から実際のThree.jsで描画します。紫の結果サンプルは`src/feature/room/referenceRoomModel.ts`で参照画像の家具形状・面ごとの色をモデル化し、正投影カメラで表示します。ドラッグ・ホイール・回転や拡大のボタン操作が同じ3Dに働き、家具をクリックすると対応商品を選べます。窓とフレームの描画面には4mm・8mmの深度差を付け、面の重なりを解消しています。植物などの細部は近似で、完全なピクセル一致は未確認です。モデルがないAPI結果は、家具の座標・寸法から簡易形状を組み立てます。

## 家具の位置・色を手動で調整する

[IKEAのルームプランナー](https://www.ikea.com/jp/ja/home-design/room/#-1/a002738a-c734-4f9d-94bc-bb6e983eb87c)を機能の参考に、配置編集を追加しています。右上のアカウントメニューで「家具の配置・色を編集」を選ぶと、商品パネルの位置に編集パネルが開きます。参照HTMLの配色・フォント・横並びの構成を維持します。

- 編集中の家具を左ボタンでドラッグし、床に沿って移動できます。ボタンではX方向・Z方向へ10cmずつ移動、15度・90度ずつ回転できます。
- 家具と壁のプレビュー色を変更できます。商品そのものの色は変わりません。
- 立体・真上・正面の視点と、選択した家具の寸法表示を切り替えられます。商品寸法は変更しません。
- 編集履歴は50件まで戻す・やり直す操作に対応し、1回のドラッグを1件として扱います。「変更を保存」でブラウザに保存します。
- 「購入リストCSV」で追加商品だけを、幅・高さ・奥行き（cm）、参考価格、ショップ、購入リンク付きで保存できます。

ドラッグではつかんだ位置を保ち、高さ・向き・サイズを変えずに移動します。立体・真上の視点ではX/Z方向、正面ではX方向だけを動かし、奥行きは維持します。背景のドラッグと通常の商品画面のドラッグは視点の回転です。移動はボタンを離した時点で確定し、Escapeキーや操作のキャンセルで元の位置へ戻します。

PCで家具の移動、1回のドラッグを単位とする元に戻す・やり直す操作、保存後の再読み込みを確認しています。Escapeキーによるキャンセルは実装レビューのみで、GUIの動作確認は未実施です。

Before表示中と、家具を含む完成GLB/GLTFでは家具をドラッグ移動できません。完成モデルの個別移動・回転・色変更にも対応していません。視点の切り替えと商品選択を利用できます。

オフラインモックの新規作成は3〜30畳と、`square`・`standard`・`long`の形を使います。backendの`RoomAnalyzer`と同じ寸法・家具配置を返し、希望・スタイル・予算から商品を生成しません。`demo()`の紫の8商品は、参照デザインを確認するサンプルとして残しています。

APIの新規作成では、解析後に表示された既存家具から活かす家具を選び、希望を500文字以内、予算を1円以上の整数で入力します。家具は初期状態で全選択です。現在のAPIは空配列を全家具の指定として扱うため、家具がある場合は1点以上の選択が必要です。新規の初期予算は3万円で、保存済みの結果は予算と選択した家具IDを復元します。backendのモックはキーワードで紫の推し活・ボタニカル・韓国風のテーマを選び、38件の商品候補から予算と配置場所に収まる商品を採用します。自由文を理解するAIではありません。結果への追加指示は同じ部屋IDと選択した家具IDを再利用して、新しい商品提案を作成します。

商品提案と追加指示には、解析時の配置と色を使います。配置・色の手動編集は提案後に行い、ブラウザへ保存します。Sceneを更新するAPIがないため、編集した配置と色は追加指示へ送信しません。

保存先はブラウザの `localStorage` にある `room-coordinator.plans` で、最大30件です。復元時は部屋データの型を検証します。以前の `roomie.saved` は使用しません。参照画面の架空ショップ名や完了表示は、結果の出所が伝わる商品検索先・サンプル表示に置き換えています。

2026年10月4日の最初の公開Swagger確認時点では、認証とユーザー管理のAPIだけでした。その後mainへ部屋解析・商品提案APIを統合し、ローカルで実行を確認しています。現在のAWS公開APIはDNS解決に失敗して再確認できておらず、mainのAPIが公開環境にも反映済みとは扱いません。APIの失敗時にサンプルへ自動で切り替えません。

このチャットでは、Swaggerの更新を1時間ごとに監視する設定を追加しています。正式契約の変更を確認してから接続を更新し、未確認のエンドポイントは自動で呼び出しません。

## 接続先を設定する

`.env.example`を`.env`へコピーします。既存の認証APIは`VITE_API_ENDPOINT`のサーバーへ接続します。開発時だけ、右上のアカウントメニューからモックとAPIを切り替えられます。選択は`hack.connection.dev`に保存され、切り替えるとページを再読み込みします。未設定なら開発時はモックです。本番ビルドは保存済みの設定を無視し、`VITE_CONNECTION=dummy`を指定してもAPIへ接続します。Viteの環境変数を変えた後は開発サーバーを再起動、または再ビルドします。

| 設定 | 意味 |
| --- | --- |
| `VITE_API_ENDPOINT` | APIのベースURL。既定は指定された公開API |
| `VITE_CONNECTION` | 開発時だけ有効。空欄なら`dummy`、`api`で実API接続 |
| `VITE_ROOM_API_CONTRACT` | 既定は`coordination`。`analysis`は部屋解析のみ、`legacy`は将来の写真API向け提案形式 |
| `VITE_ROOM_GENERATION_PATH` | 部屋作成POST先。既定は`/api/v1/rooms` |
| `VITE_ROOM_JOB_PATH` | 部屋取得GET先。既定は`/api/v1/rooms/{id}` |
| `VITE_ROOM_COORDINATION_PATH` | 商品提案POST先。既定は`/api/v1/rooms/{id}/coordinations` |
| `VITE_ROOM_COORDINATION_JOB_PATH` | 提案取得GET先。既定は`/api/v1/coordinations/{id}` |
| `VITE_ROOM_REQUIRES_AUTH` | 正式な部屋・提案APIの既定は`false`。`legacy`では未指定なら認証付き |
| `VITE_ROOM_*_FIELD` | `legacy`の写真・指示・雰囲気・予算の送信フィールド名 |

`VITE_`の値はブラウザへ公開されます。秘密鍵やアクセストークンを設定しません。認証トークンは既存のトークン管理を使います。

## 部屋解析と商品提案のAPIをつなぐ

正式契約は`backend/swagger/v1/swagger.yaml`、変換は`src/data/records/room.ts`、通信は`src/data/repositories/apiRoomRepository.ts`です。画面は`RoomRepository`だけに依存します。部屋・商品提案のエンドポイントは公開で、ログインを必要としません。

1. `POST /api/v1/rooms`へ`{ room: { tatami, shape } }`をJSONで送ります。`GET /api/v1/rooms/{id}`で`analyzing`から`ready`になるまで待ちます。
2. 解析Sceneの家具から活かすものを選び、希望と予算を入力します。
3. `POST /api/v1/rooms/{id}/coordinations`へ`{ coordination: { prompt, budget, kept_object_ids } }`を送ります。`kept_object_ids`は選択した解析Sceneの家具IDです。`GET /api/v1/coordinations/{id}`で`pending`・`processing`から`done`になるまで待ちます。

取得は2秒おき、各処理で最大120秒です。`failed`はエラーとして表示し、画面からのキャンセルで通信と待機を止めます。追加指示では`backendRoomId`で部屋を再取得し、保存した家具IDを指定して解析済みの部屋へ提案だけを追加します。

部屋と家具の型は`src/domain/room.ts`です。backendのSceneは北西の床の角を原点とし、家具位置は底面中心です。画面へ変換するときはX/Zから部屋の幅・奥行きの半分を引き、Yへ家具の高さの半分を加え、部屋中央原点の中心座標にします。単位はメートル、Y軸が高さ、`rotation_y`は度です。部屋の幅・奥行き・高さ・床色・窓の壁と寸法を3Dへ反映します。

商品はSceneの`marker`・`item_id`と提案商品の対応を検証して結び、家具の選択番号と購入リンクを一致させます。`before_scene`を別のスナップショットとして保持し、Before表示にもAPIの部屋・家具を使います。形式が違う応答はエラーにし、座標や商品情報を補いません。商品とモデルのURLはHTTPまたはHTTPSだけを受け入れます。

部屋の`model_kind`（画面側は`modelKind`）は`complete`または`shell`です。`model_url`がある場合、未指定なら家具を含む完成モデルとして表示し、家具の座標と寸法を選択・購入リンクの対応に使います。家具を含まない部屋モデルは`shell`にすると、各家具のモデルまたは簡易形状を追加表示します。部屋モデルの読み込みに失敗した場合は、簡易表示を残します。

現在のローカルAPIは`http://127.0.0.1:13000`です。他プロジェクトが3000番を使っているため、`/tmp/room-api-runtime.override.yaml`でAPIだけを13000番へ割り当てています。起動・更新時は既存のサービスを再利用します。

```bash
docker compose -f compose.yaml -f compose.override.yaml -f /tmp/room-api-runtime.override.yaml up -d --no-build api worker
# frontendの環境変数
VITE_API_ENDPOINT=http://127.0.0.1:13000
VITE_CONNECTION=api
```

PR #5の統合前のローカルでは、既存APIテスト23件・RuboCop・Swagger再生成・型生成、フロントのlint・ビルドが成功しています。PC画面でも6畳・標準・紫・3万円の提案が8点・28,840円になることを確認しました。実際の商品画面のスクリーンショットは`output/screenshots/frontend-mock-api-pc.jpg`です。統合後の検証結果は別途記録します。

`legacy`は未提供の写真APIを接続するための提案形式です。JPEG・PNG・WebPの写真3〜4枚（1枚10MB以内）をmultipartで送る処理と、独自の同期・非同期応答の変換を残しています。mainの正式APIへ写真は送りません。写真解析とAIコーディネートは今後の実装対象です。

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | 型チェック + 本番ビルド (`dist/`) |
| `npm run lint` | eslint |
| `npm run typecheck` | tsc |
| `npm run types` | `../backend/swagger/v1/swagger.yaml` から TS 型を再生成 |

規約・レイヤ構成・エンドポイントの足し方は [.claude/docs/frontend.md](../.claude/docs/frontend.md)。
