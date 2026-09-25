# 開発方針

- 目的と根拠を確かめ、簡潔に伝える。可逆な細部はAIが判断し、重大な未決事項だけ質問する。
- 仕様のSSOTとGoogle Docs URLは [docs/project.md](docs/project.md)。DocsはMCP経由で読み取り、重要な判断・未反映差分はローカルSpecへ残す。
- `.agents/skills/hackathon-*` を用途で選ぶ。固定フロー・細かな承認待ちは不要。厳格SDDの明示指定は尊重する。
- フロント・backend・infraとも新規テストは原則書かず、TDDはしない。既存CIは維持し、API契約生成に必要な最小rswag定義だけは追加・更新する。
- 変更に関係する既存検証を使い、テスト追加は必要性が合意された場合に限る。要求を削って完了扱いせず、未検証・代替実装を明記する。
- backendは [.claude/docs/backend.md](.claude/docs/backend.md)、iOSは [.claude/docs/ios.md](.claude/docs/ios.md)、infraは [infra/README.md](infra/README.md) を参照する。
- 独立作業はサブエージェントへ分担し、アプリ・コンテナ等は再利用する。PRはリポジトリのテンプレートに従う。
