# 本番AIの最小設定と確認

2026-10-04の安全なCloud Run設定確認では、API revision `zenn-hackathon-api-00011-hlx` がtraffic100%。`GEMINI_API_KEY` / `GEMINI_MODEL` / `GEMINI_THINKING_LEVEL` はいずれも未設定。統合PR #18の実公開接続と3Dは確認済みだが、実AI生成は未確認で、現状はmockが選ばれる。

根拠は本人の「既存backend/infraを確認して接続・検証・公開」依頼とlive設定metadata。Google Docs URLは `docs/project.md` が空欄のため未確認・未反映。

## 本人が承認する最小範囲

この変更のbackendがCI・deployを通り、Room ownerによるallowlist判定が動くrevisionになってからキー参照を有効にする。PR #18時点のbackendにはこのallowlistがないため、環境変数だけを先に追加しない。

- 同じGCP project `zenn-hackathon-takarada` に既にあるGeminiキーのSecret IDと固定versionを指定する。キーの値はチャット・Git・Terraformへ渡さない。既存Secretがなければ、本人が安全なSecret Manager入力画面で値を登録する。新規キー作成・Secret作成の費用と権限は別途具体確認する。
- 指定Secret1つに対する既存APIサービスアカウント `zenn-hackathon-api@zenn-hackathon-takarada.iam.gserviceaccount.com` の `roles/secretmanager.secretAccessor`。既存許可はこの設定で管理・削除しない。許可がなく今回の新規付与が承認された場合だけ `gemini_grant_secret_access=true` で追加する。このSAは既存DBタスクとも共有しているため、IAMの読み取り能力も共有されるが、キーのenv参照はAPIにだけ追加する。新しいSA・project全体のrole・公開IAMは追加しない。
- 既存APIだけにSecret参照env `GEMINI_API_KEY`、モデル `GEMINI_MODEL=gemini-3.1-flash-lite` を追加し、新revisionのhealthを確認する。thinking levelは既定値を維持、必要な場合だけ明示設定する。Web・DB・Miniへキーを渡さない。
- 実AIを使える部屋ownerを、管理下の使い捨て検証アカウント1件のIDへ限定する。`gemini_allowed_user_ids` が空なら全員mock、指定ID以外もmock。本番でallowlist envが未設定でもmockを選び、キー追加だけで一般AIを有効にしない。判定に使うIDはサーバー側のRoom ownerで、requestの任意IDは使わない。
- 検証は合成room画像1枚の写真解析1操作と、短い希望文からのcoordination1操作。ユーザー写真は使わない。内部retry最大3attempt/操作なので最大6HTTPモデルcall、各操作の総期限90秒。これは管理下の検証操作の上限で、アプリ全体の金額制限・操作回数quotaではない。検証者が操作を2回に限定し、試験終了後にallowlistとキー参照を戻す。モデル追加比較や多件数生成をしない。
- 既定モデルでの試験予算上限案は税込USD3。既存free/paid tier、税、残予算、実モデルを本人と確認してから実行する。tierを新規有料へ変更したり、支払い情報を追加したりする操作はこの設定に含めない。
- 一般ユーザー向け実AIは別の承認範囲。`gemini_allow_all_users=true` を明示設定するまで有効にしない。これは継続費用を伴い、今回のUSD3検証予算では上限を保証しない。現アプリには利用者別quotaや総課金上限はない。

## 秘密値を扱わないTerraform設定

`gemini_api_key_secret_id` が空の既定状態では、Gemini envも権限も追加しない。指定時は既存Secretを参照するだけで、Secret本体やversion/payloadは作らず、値をTerraform stateへ持ち込まない。

```hcl
# 例。実際に存在・有効性を確認したID/versionへ置き換える。
gemini_api_key_secret_id      = "existing-gemini-api-key"
gemini_api_key_secret_version = "1"
gemini_model                  = "gemini-3.1-flash-lite"
gemini_allowed_user_ids       = [123] # 作成した使い捨てownerの実ID
gemini_allow_all_users        = false
# gemini_grant_secret_access  = true  # 新規grantが必要・承認済みの場合だけ
# gemini_thinking_level       = "low" # 本人が明示選択した場合だけ
```

承認前はapplyしない。既存state/認証を持つowner環境で、まず既存Secretの名前・有効version・IAMだけをreadする（payloadへaccessしない）。既存IAM memberをこの設定へimportせず保持し、planは今回新設する指定Secretの読み取りmember（必要な場合だけ）とAPI env以外に影響しないことを確認する。既存imageの巻戻しやDB/他Secret/バケットIAM変更が含まれる場合はそのplanを実行しない。

通常GitHub deployはimage更新だけで、これらのTerraform変数をapplyしない。設定PRをマージしただけでは本番AIが有効になったとは扱わない。APIのinline生成にキーを渡すため、DBタスクのenvやworkerを新設する必要はない。別環境でworkerを使用する場合はそのworkerにも同じ承認済み参照を明示する必要がある。

## 費用の根拠

[公式料金](https://ai.google.dev/gemini-api/docs/pricing)のstandard Gemini 3.1 Flash-Liteはtext/image入力$0.25 / 100万token、thinking込み出力$1.50 / 100万token。[公式モデル上限](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)は入力1,048,576、出力65,536 token。[Interactions API対応モデル一覧](https://ai.google.dev/gemini-api/docs/interactions-overview)にこのモデルが含まれる。料金・対応は2026-10-04に確認。

6attemptがすべてtoken上限を使う保守的なtoken料金計算は `6 × (1,048,576 × $0.25 + 65,536 × $1.50) / 1,000,000 = $2.162688`。短文と合成画像1枚の実利用はこれより少ない見込みだが、請求額を断定しない。liveモデルが異なる場合は再計算し、同じ上限を使い回さない。画像生成・検索grounding等の別サービスは呼ばない。

## 成功とロールバック

API health200、指定revision/traffic/env参照を確認後、使い捨て所有者アカウントで写真signed PUT→room `ready` / `analyzed_by=gemini`→coordination `done` / `planned_by=gemini` を確認する。GCSモデルURL、予算内item合計、既存家具の編集位置を維持していること、他owner404も確認し、検証アカウントと写真をcleanupする。mock・failed・timeoutでは実AI成功としない。

緊急停止はまず直前のキーなしAPI revisionへtrafficを戻し、API healthとmock表示を確認する。traffic復帰だけでは新revisionの設定・IAMは残るため、その後 `gemini_api_key_secret_id` とallowlistを空へ戻したplanを確認して設定を戻す。今回新設したgrantだけを削除し、元からあるgrantとSecret payloadは保持する。公開domain/DNS/TLS/GCS CORSは別の承認済み変更範囲として扱い、この設定に含めない。
