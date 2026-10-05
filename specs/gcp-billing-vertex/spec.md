# クーポンとGeminiのGCP移行

2026-10-05の依頼に基づき、`zenn-hackathon-takarada` の利用料を300米ドルのクーポン適用先にまとめ、Geminiを個人APIキーからVertex AIへ移行する。Google Docs URLは未設定のため未確認・未反映。

## クーポン登録と請求先変更は完了

現在の請求先は本人指定のアカウント。初回確認時、本人には旧請求先の参照・クーポン登録権限がなかった。公開リポジトリには請求先の個人名・ID、クーポンコード・ID、個別の残高を保存しない。

本人が登録の最終ボタンを押し、Billing Creditsで利用可能な残高と有効期限を確認した。プロジェクトの請求先変更も成功し、`billingEnabled=true` を確認した。

本人がOwner招待を承認した後、GCPで `roles/owner` を確認した。プロジェクトの管理権限は有効。請求先アカウントの権限はプロジェクトの権限と別に確認する。

Storage、Cloud Run、Cloud SQLなど同じプロジェクトの今後の利用料は、新請求先に集計される。変更前の利用料は旧請求先に残る。

クレジットの残高は請求アカウント単位で共有するため、同じ請求先の他プロジェクトの対象利用料にも消費される。個別SKUへの充当と利用後の請求レポートは未確認。

主催者の案内では、登録期限は2026-10-20、登録後2か月間有効。有料アカウントとクレジットカードが必要で、超過分は通常課金される。一部サービスは対象外で、今回のクレジットが全SKUに適用されることは未確認。

## Vertexは既存Cloud Runのサービスアカウントを使う

`GEMINI_PROVIDER=vertex` はGoogleのADC認証を使い、指定プロジェクトのInteractions APIを呼ぶ。個人キーへ自動的に戻さない。既存モデル `gemini-3.1-flash-lite`、画像入力、JSON Schema、期限90秒、最大3回の試行、owner制限、test環境のmock動作を維持する。Vertex側のAPIはPreviewで `global` のみ対応する。

既存APIサービスアカウントは `zenn-hackathon-api@zenn-hackathon-takarada.iam.gserviceaccount.com`。本人の切替依頼を受け、`aiplatform.googleapis.com` を有効にし、このアカウントへ `roles/aiplatform.user` を付与した。

切替前のrevision `zenn-hackathon-api-00014-tz5` のサービス設定には `GEMINI_*` のenv名がなかった。稼働イメージの内容を維持し、GeminiClientだけを差し替えたrevision `zenn-hackathon-api-00015-xed` を配置した。

新revisionには `GEMINI_PROVIDER=vertex`、`GOOGLE_CLOUD_PROJECT=zenn-hackathon-takarada`、`GOOGLE_CLOUD_LOCATION=global`、`GEMINI_MODEL=gemini-3.1-flash-lite` を設定した。`GEMINI_API_KEY` の環境変数・Secret参照はない。allowlist未設定の既存利用方針を維持し、本人のRoom ownerで判定する認証・データ分離は変更していない。

## 完了条件と現在の状態

- クーポンの登録、利用可能な残高、期限は確認済み。対象サービスの範囲は未確認。
- 対象プロジェクトの請求先を本人指定のアカウントへ変更済み。課金は有効。
- 既存APIサービスアカウントへVertex権限を付与し、APIを有効化済み。
- 対応コードを配置し、既存owner制限を維持してVertexへ切替済み。本番トラフィック100%を検証済みrevisionへ反映した。
- 画像入力と家具提案の実呼出を確認済み。呼出先に対象プロジェクトを指定し、ADCで認証する。利用明細への反映とクーポンの個別SKU充当は未確認。

Vertex対応コードとTerraform設定は追加済み。クーポン登録、請求先変更、モデル呼出の本番切替は完了した。Gemini Enterprise Agent PlatformのADK・Agent Runtimeは[構成案](../../docs/agent-platform-proposal.md)の段階で、実装・デプロイ済みとは扱わない。

既存APIコンテナの一時領域でRuby構文、GeminiClient・rooms・coordinationsの既存RSpecを確認し、18例が成功した。変更したRubyファイルのRuboCopとTerraformのfmt・validateも成功した。

Cloud Runの検証URLで一時ユーザーを作り、リポジトリの公開アプリ画像をGCSへアップロードした。保存後のGETで `analyzed_by=gemini/status=ready`（約4.5秒）、`planned_by=gemini/status=done`（約2.6秒、7商品、合計28,660円、予算30,000円以内）を確認した。室内写真の認識精度を測った検証ではない。一時ユーザー、部屋、提案、GCS画像は削除した。

## 出典

2026-10-05に本人の依頼、添付クーポン、GCP CLIと実効権限確認API、コンソールの登録画面とBilling Creditsを確認した。

- [主催者のクーポン条件](https://zenn.dev/hackathons/google-cloud-japan-ai-hackathon-vol5)
- [請求先変更の権限と利用料](https://docs.cloud.google.com/billing/docs/how-to/modify-project)
- [Vertex Interactions APIと認証](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/interactions/developer-guide)
- [APIリファレンス](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/interactions-api)
