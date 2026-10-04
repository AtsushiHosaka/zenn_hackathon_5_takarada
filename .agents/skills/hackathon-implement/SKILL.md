---
name: hackathon-implement
description: ハッカソンのSpecに沿って実装し、既存CI・Swagger生成・ビルドで確認する。新規テストとTDDは原則行わず、Google Docsとの未反映差分を残す。
---

# Hackathon Implement

依頼された範囲を実装し、共有Specと確認結果を整える。固定フローや形式的な承認待ちは不要。

## 実装の基準

- `docs/project.md` に従ってGoogle Docs対応スキルからMCP経由で読み、ローカルSpec・コード・領域別規約を確認する。
- Docs未設定・取得不能なら提供資料を暫定の根拠とし、未確認を明示する。
- 新規Specは `specs/<feature>/spec.md`。目的、受け入れ条件、重要な判断と出典を残す。
- 明示されたユーザーの変更は反映し、Docs未反映の差分として記録する。Docsは勝手に編集しない。
- 可逆な細部はAIが判断する。未決の目的分岐・破壊・費用・公開・権限など重大事項のみ確認する。
- 実装中にローカルSpecを更新してよい。実装に合わせて要求を削ったり弱めたりしない。
- 「急いで」「実装優先」なら実装を先行し、まとまった変更ごとに判断と差分を記録する。

## テストを増やさない

- フロント・backend・infraとも新規テストは原則書かず、TDDは行わない。
- 既存テストとCIは維持する。必要性が合意された場合だけテストを追加する。
- 例外はAPI契約生成に必要な最小rswag定義の追加・更新。網羅的なケース追加には広げない。
- 変更に関係する既存テスト、lint、ビルド、実動作確認を選び、無関係な検査を増やさない。
- 未検証と成功は区別する。既存の失敗を隠すためにテストを削除・無効化しない。

## backendとAPI契約

- `.claude/docs/backend.md` を読む。現行はRails、DBの正本は `backend/db/Schemafile`。
- API変更時は `backend/spec/requests/` と `backend/spec/swagger_helper.rb` の契約を更新する。
- `make docs` で `backend/swagger/v1/swagger.yaml` を再生成して同じ変更に含める。生成物を直書きしない。
- 契約はiOS担当へ早く共有し、実装済みか未実装かを明示する。
- `make test` は既存のRails request spec。対象を絞る場合は `docker compose exec api bundle exec rspec <path>`。
- lintは `docker compose exec api bin/rubocop -f github`。CIはRSpec・Swagger再生成差分・RuboCopを確認する。
- Swagger生成成功は動作確認ではない。request specもiOSからAWSまでのE2Eではない。

## iOSとinfra

- iOSは `.claude/docs/ios.md` を読み、変更時は `make ios-build` 等で確認する。
- `Info.plist` がなければ `make ios-setup`。ダミー動作・ビルド成功と実API接続成功を区別する。
- infraは `infra/gcp/README.md` を読み、shell変更は `bash -n`、Terraform変更はfmt/validateを使う。
- Terraformはホストの `terraform -chdir=infra/gcp` を使う。validateの初期化が必要なら `init -backend=false`。
- GCPへ接続するplanや、apply・deploy・destroy・seed・resetは通常検証として一律に実行しない。
- 既存アプリ・コンテナを再利用し、独立作業の編集範囲と共有資源の競合を避ける。

## 完了の判断

- 問題を修正したら影響する確認だけやり直す。新しい根拠なしに同じ失敗を繰り返さない。
- ローカルSpecを実装と整合させ、Docs未反映・未実装・未検証・デモ用代替を区別する。
- 最後に変更、実行した確認と結果、残課題を短く伝える。一部の成功を全体の完了としない。
