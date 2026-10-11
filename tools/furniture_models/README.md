# 家具GLBの生成

[docs/3d-model-prompts.md](../../docs/3d-model-prompts.md) の制作一覧を、BlenderのPythonスクリプトで形状から組み立てて書き出す。パステル寄りのフラットなイラスト調 (マット・面がはっきりした陰影・太めの部材) に揃えている。金属感は付けない (アプリは環境マップがなく、金属素材が黒く沈むため)。

```bash
# 全モデルを output/furniture_models/furniture/ へ書き出す (Blender 5.1 で確認)
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/furniture_models/build.py
# 一部だけ、別の出力先へ
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/furniture_models/build.py -- /tmp/out sofa_2seat.glb
# 色・サイズのバリエーションを1件だけ生成する場合
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/furniture_models/build.py -- /tmp/out bed_cover__201.glb
# GLBを実測し、DB用の backend/db/furnitures.json を更新
python3 tools/furniture_models/manifest.py
# 確認用の一覧画像。view=front|back|top|side、engine=eevee でアプリに近い光、checker でUV確認
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/furniture_models/preview.py -- output/furniture_models/furniture /tmp/sheet.png view=back engine=eevee
```

- `lib.py`: 形状ヘルパーと書き出し。アプリ座標 (+Y上・+Z正面) で組み立て、底面中心を原点にし、指定寸法へ合わせて書き出す。
- `models_*.py`: モデル定義。`@asset(ファイル名, (幅, 高さ, 奥行き), variants=...)` で登録する。
- `manifest.py`: GLBの頂点・変換・容量・素材を照合し、名称、実寸、SHA256、商品や既存家具との対応をDB用JSONへ書き出す。`build_report.json`に記録した書き出し時のSHA256と実ファイルが一致しない場合は取り込みを止める。別の生成先は`--models-dir`、別レポートは`--report`、別JSON出力先は`--output`で指定する。
- 白に近い低彩度の色は `lib.soften` で暖かい灰色へ寄せる (カタログの白・アイボリーも含む)。純白は使わない。
- 色を変える部分は素材名 `tint`。木・金属・葉・透明面・発光部 (`light`) は別素材。素材名の一覧はDB用JSONの`materials`に保存する。
- `ファイル名__接尾辞.glb` は商品別の色違い (`__101` など) とサイズ違い (`__w130` など)。現行ローダーは `tint` の色替えと軸ごとの伸縮に未対応のため、別ファイルにしている。
- 一部生成でベース名を指定すると、そのモデルの全バリエーションも生成する。接尾辞を含むファイル名を指定すると、そのバリエーションだけを生成する。
- 全モデルにUVを付けている。面の向きごとの箱投影で、1UV = 1m。繰り返しテクスチャを全モデル同じ実寸で張れる。
- フロントでの張り替えは [furnitureMaterials.ts](../../frontend/src/feature/room/furnitureMaterials.ts) の `applyMaterialOverrides(gltf.scene, { tint: { textureUrl, tileSize: 0.5 } })`。素材名で色・テクスチャを上書きし、素材は複製するので同じGLBを使うほかの家具に影響しない。
- 柄・織り目 (リネン調、ワッフル、ジュート、リーフ柄、ボタニカル柄、ブークレ) はGLBに含めていない。上記のテクスチャ差し替えで付ける。

GLBはGit管理外の`output/`に保存し、フロントへ同梱しない。GCSへの配置とDBへの取り込みは[家具モデルの運用手順](../../docs/furniture-models.md)を参照。

## AI で作る (`generator/`)

管理画面の「3Dモデルを作る」が使うジョブ。商品の画像と寸法から Gemini にモデルの定義 (上の `@asset` の書き方) を書かせ、検査・組み立て・描画までを行う。仕様は [specs/model-generation/spec.md](../../specs/model-generation/spec.md)。

- `generate.py`: ジョブの本体。置き場 (`GENERATION_URI`。`gs://...` か手元のディレクトリ) の `request.json` を読み、`result.json`・`model.py`・`model.glb`・`front.png`・`side.png` を置く。
- `checks.py`: 検査 (許した書き方、浮いた部品、部位の名前、光る素材、三角形数など)。
- `build.py` / `render.py`: 検査済みの定義の組み立てと、確認用の画像の描画 (Cycles の CPU)。別プロセスで動かす。
- `Dockerfile`: Cloud Run のジョブのイメージ。Blender 本体は入れず、`bpy` だけを使う。

```bash
# 手元で 1 つ作る (Python 3.13 の環境に bpy==5.1.2 numpy google-auth requests google-cloud-storage を入れておく)
mkdir -p /tmp/gen && echo '{"model_key": "ai_test", "name": "ラウンドスツール", "category": "chair", "size": {"w": 0.35, "h": 0.45, "d": 0.35}, "color": "#e2c08f", "material": "木", "image_url": null}' > /tmp/gen/request.json
GENERATION_URI=/tmp/gen GOOGLE_CLOUD_PROJECT=<project> python tools/furniture_models/generator/generate.py
```

AI で作ったモデルは DB だけが持ち、`backend/db/furnitures.json` には載せない。
