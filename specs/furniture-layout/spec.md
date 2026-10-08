# 家具を10cmのマス目に沿って動かし、再生成にも配置を引き継ぐ

2026年10月4日のユーザー依頼を根拠とする。Google DocsのURLは `docs/project.md` に未設定のため、共有仕様は未確認。この変更はDocsへ未反映。

2026年10月5日、大型家具の追加・入れ替えも対象に加わった。残す家具の保護、交換対象の指定、商品寸法による配置判定、失敗時の元家具の維持は[EC家具Spec](../ec-furniture/spec.md)に記す。以下は現行の手動編集仕様であり、大型家具の自動配置・交換も実装済みで、詳細と検証はEC家具Specを参照する。

## 配置編集では床にマス目を表示する

編集モードのAfter表示に10cm間隔の格子を表示し、50cmごとの線を少し強くする。通常表示とBefore表示では格子を隠す。家具を含む完成モデルは従来どおり個別編集の対象外とする。

ドラッグ中のプレビューと確定座標を同じマス目に合わせる。立体・真上ではX/Z、正面ではXだけを動かし、高さ・向き・寸法を維持する。位置調整ボタンも同じ格子を使う。解析済みの部屋では回転後の家具寸法を含めて床内に収め、部屋に収まらない角度の回転は無効にする。未編集の初期配置を一括で格子に合わせることはしない。

1回のドラッグを履歴1件とし、取消、元に戻す、やり直す、保存、再読み込みを維持する。

## 商品提案は現在の家具配置から作る

既存家具の最新配置と、手動編集した追加商品の配置を生成入力へ渡す。ブラウザ保存には編集内容も含め、生成を重ねても引き継ぐ。既存家具を選択から外して再び選んだ場合も、その家具の編集を復元する。

商品提案APIの `coordination.edited_objects` に、家具のID、座標、寸法、回転角度、プレビュー色を送る。未指定は空配列とし、従来のクライアントを維持する。編集対象は同じ部屋の既存家具、手動で補完した所有家具、過去に提案済みの商品とし、不正な座標やIDは422で拒否する。手動補完は[家具追加Spec](../manual-furniture/spec.md)に記す。

生成側は編集後の既存家具を使い、追加商品の置き場所を計算する。同じ商品を再び採用する場合は、調整した配置・角度・色を維持する。別の商品への置換や予算外の不採用商品へは編集を引き継がない。未編集のカバーや小物は、移動した家具に合わせて配置する。

Beforeは元の解析結果を表示し、再生成の入力で書き換えない。床内検証と配置計算は15度単位の手動回転に対応する。

## Review correction: issue #37 (2026-10-08)

The effective preview color preserved by SlotLayout also controls model material overrides during regeneration. Official product color metadata remains unchanged. When the preview color differs from the product color, description-based texture generation is skipped so it cannot overwrite the user's edit. This follows the existing same-product edit requirement; the Google Docs URL is unset and this correction has not been reflected there.

## 検証結果と公開前に必要な作業

フロントのlint、型チェック込みビルド、backendの既存request spec 23件、RuboCop、Swagger生成、フロントのAPI型生成に成功した。新規テストは追加していない。

Chromeで格子表示、ラグのドラッグ、元に戻す・やり直す、位置調整ボタン、15度回転、保存・再読み込みを確認した。保存後のラグはX60cm、Z40cm、15度を維持した。正面で植物をドラッグするとXが164.1cmから110cmへ動き、Zは152cmを維持した。奥行きの精度保持と取消処理はコードと座標計算でも確認した。ドラッグ取消のGUI確認は未実施。

既存コンテナを再利用し、専用DBで部屋解析から商品提案まで確認した。3・6・30畳と3種類の形で既存家具を送れること、15度回転したベッドと付属品の配置、商品編集の2回連続再生成、安価な代替商品を再採用する場合の編集保持、Before不変、不正IDと床外入力の拒否を確認した。

公開環境へは未反映。backendの `db/Schemafile` に追加した `coordinations.edited_objects` を適用し、backendとフロントを更新する必要がある。写真解析とAI生成は既存の未接続状態を維持する。
