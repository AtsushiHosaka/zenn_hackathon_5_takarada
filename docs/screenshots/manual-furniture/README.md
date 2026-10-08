# 家具追加・配置編集の確認画像

2026年10月8日、ローカルのVite画面とRails APIで撮影した。デスクトップは1440×900px、狭いウィンドウは547×853px。

部屋の背景と既存の提案商品はサンプルデータ。リンクから追加する家具は、実際のIKEA TEODORES商品ページをローカルAPIで取得したもの。取得時の商品名、46×80×54cm、6,000円、商品写真とカタログの椅子GLBを確認した。画面上の写真はIKEAの商品写真で、3D形状はカタログの近似モデル。スクリーンショットだけを、本番での動作や実商品の形状再現の証拠として扱わない。

| 画像 | 確認した状態 |
| --- | --- |
| [01-link-product-desktop.png](01-link-product-desktop.png) | デスクトップのURL入力と実商品写真。紫の枠・背景、対応ショップ案内を削除 |
| [02-manual-palette.png](02-manual-palette.png) | リンクなしの6種類の家具選択とcm寸法入力 |
| [03-manual-placement-edit.png](03-manual-placement-edit.png) | ソファのドラッグ追加後に寸法・位置・回転・色を編集 |
| [04-saved-restored.png](04-saved-restored.png) | 保存と再読み込み後に幅160cm、X70cm・Z140cm、15度と色を保持 |
| [05-before-disabled.png](05-before-disabled.png) | Before表示では家具カード・寸法入力・追加ボタンが無効 |
| [06-invalid-product-url.png](06-invalid-product-url.png) | 取得できないURLはエラーを表示し、家具を作らない |
| [07-recommendation-list.png](07-recommendation-list.png) | 商品一覧の補足説明を整理。商品名・価格・購入リンクは維持 |
| [08-link-product-narrow.png](08-link-product-narrow.png) | 狭いウィンドウで写真・商品名・寸法・価格・追加ボタンを表示 |
| [09-saved-product-photo.png](09-saved-product-photo.png) | 保存・再読み込み後の家具に商品写真とリンクを保持 |
| [10-oversized-furniture.png](10-oversized-furniture.png) | 推定寸法のサンプル部屋でも、部屋より大きい家具の追加を拒否 |

関連する実動作・APIの検証は [家具追加Spec](../../../specs/manual-furniture/spec.md) に記録した。
