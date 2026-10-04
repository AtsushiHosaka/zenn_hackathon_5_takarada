# 家具GLBの生成

[docs/3d-model-prompts.md](../../docs/3d-model-prompts.md) の制作一覧を、BlenderのPythonスクリプトで形状から組み立てて書き出す。パステル寄りのフラットなイラスト調 (マット・面がはっきりした陰影・太めの部材) に揃えている。金属感は付けない (アプリは環境マップがなく、金属素材が黒く沈むため)。

```bash
# 全モデルを output/furniture_models/furniture/ へ書き出す (Blender 5.1 で確認)
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/furniture_models/build.py
# 一部だけ、別の出力先へ
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/furniture_models/build.py -- /tmp/out sofa_2seat.glb
# GLBを実測し、DB用の backend/db/furniture_models.json を更新
python3 tools/furniture_models/manifest.py
# 確認用の一覧画像。view=front|back|top|side、engine=eevee でアプリに近い光、checker でUV確認
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/furniture_models/preview.py -- output/furniture_models/furniture /tmp/sheet.png view=back engine=eevee
```

- `lib.py`: 形状ヘルパーと書き出し。アプリ座標 (+Y上・+Z正面) で組み立て、底面中心を原点にし、指定寸法へ合わせて書き出す。
- `models_*.py`: モデル定義。`@asset(ファイル名, (幅, 高さ, 奥行き), variants=...)` で登録する。
- `manifest.py`: GLBの頂点・変換・容量・素材を照合し、名称、実寸、SHA256、商品や既存家具との対応をDB用JSONへ書き出す。別の生成先は`--models-dir`、別レポートは`--report`、別JSON出力先は`--output`で指定する。
- 白に近い低彩度の色は `lib.soften` で暖かい灰色へ寄せる (カタログの白・アイボリーも含む)。純白は使わない。
- 色を変える部分は素材名 `tint`。木・金属・葉・透明面・発光部 (`light`) は別素材。素材名の一覧はDB用JSONの`materials`に保存する。
- `ファイル名__接尾辞.glb` は商品別の色違い (`__101` など) とサイズ違い (`__w130` など)。現行ローダーは `tint` の色替えと軸ごとの伸縮に未対応のため、別ファイルにしている。
- 全モデルにUVを付けている。面の向きごとの箱投影で、1UV = 1m。繰り返しテクスチャを全モデル同じ実寸で張れる。
- フロントでの張り替えは [furnitureMaterials.ts](../../frontend/src/feature/room/furnitureMaterials.ts) の `applyMaterialOverrides(gltf.scene, { tint: { textureUrl, tileSize: 0.5 } })`。素材名で色・テクスチャを上書きし、素材は複製するので同じGLBを使うほかの家具に影響しない。
- 柄・織り目 (リネン調、ワッフル、ジュート、リーフ柄、ボタニカル柄、ブークレ) はGLBに含めていない。上記のテクスチャ差し替えで付ける。

GLBはGit管理外の`output/`に保存し、フロントへ同梱しない。GCSへの配置とDBへの取り込みは[家具モデルの運用手順](../../docs/furniture-models.md)を参照。
