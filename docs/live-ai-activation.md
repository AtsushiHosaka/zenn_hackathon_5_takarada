# 既存Gemini設定の経路と互換性

2026-10-04、本人はチームメンバーの既存Geminiキーを使う意図を明示した。新しいキー入力・Secret・IAMの提案は取り下げ、既存設定の所在と実行時の状態を先に確認する。Cloud Run revisionのenv名にキーがないことだけで、チームのキーや実行時のキーが存在しないとは扱わない。

根拠は本人の訂正、PR #14 / #15の実AI検証記録と既存ソース。Google Docs URLは `docs/project.md` が空欄のため未確認・未反映。

## ソースで確認できた設定経路

- [PR #14](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/pull/14) はチームの `backend/.env` をapiとworkerへ渡し、写真解析が `analyzed_by=gemini` となった検証を記録している。[PR #15](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/pull/15) も同じ既存設定で実AI家具提案を検証している。両PRには、その時点の本番キーは未設定でmockという記録もある。ローカル実AIの成功と本番への設定継承を区別する。
- `compose.override.yaml` は `backend/.env` をapiとworkerへ注入する。Railsのdotenv loaderはなく、GeminiClientは `ENV["GEMINI_API_KEY"]` だけを読む。Rails Credentials、別名キー、Vertex/ADCへのフォールバックは実装されていない。ADCはGCS/signBlobで使われる。
- 通常のCI buildは `backend/.dockerignore` で `.env` を除外し、DockerfileにもGeminiのENV/ARGや起動時のenv読込はない。GitHub deployは既存Cloud Runのimageを更新する。これは標準のソース経路の確認であり、稼働imageの内容や実行時envを確認したことにはならない。
- Webは同一オリジン `/api` をserver側の `API_UPSTREAM_ORIGIN` へ中継する。2026-10-04に認証済みownerがCloud Run API v2のservice metadataで、numeric `zenn-hackathon-api-262220651661.asia-northeast1.run.app` とhash `zenn-hackathon-api-55ceumihtq-an.a.run.app` の両URLが同じサービスのurlsに含まれることを確認した。別名へのJWT送信は行っていない。

## allowlist未指定時の互換性修正

PR #15はキーがありtest以外なら実AIを使う。PR #19で追加したallowlistは、未指定のproductionでもmockに切り替えていた。本人が求めていない既存キーの無効化を避けるため、allowlistが明示された場合だけ制限する。

| キー / 環境 | GEMINI_ALLOWED_USER_IDS | 判定 |
| --- | --- | --- |
| キーあり、test以外 | 未指定 | PR #15と同じ既存キー判定で実AI |
| キーあり、test以外 | 明示した空文字 | 全ownerがmock |
| キーあり、test以外 | owner IDのリスト | 一致するserver側Room ownerだけ実AI |
| キーあり、test以外 | 明示した `*` | 既存の明示的wildcard動作を維持 |
| キーなし、またはtest | 任意 | mock |

リクエストの任意user IDで判定しない。ownerによるアクセス分離、生成期限90秒と既存の最大3attemptは維持する。この修正は環境変数の設定や `*` の有効化を含まない。

## 実行時の読み取り確認

既存APIとDB jobのimmutable image、command、args、env参照、volume/startup設定を秘密値なしで比較する。imageが一致してもjobとAPIのenvやcommandが異なる場合、jobで得た結果をAPIの証明として扱わない。

既存jobの実行だけをoverrideして使う場合、Rails runnerの出力は次の3つのbooleanに限定する。DB query、モデル呼出、キーの値・長さ・末尾・hashは出力しない。

```ruby
puts JSON.generate(
  "key_present" => ENV["GEMINI_API_KEY"].present?,
  "allowed_present" => ENV.key?("GEMINI_ALLOWED_USER_IDS"),
  "production" => Rails.env.production?
)
```

API runtimeに対応する結果が `key_present=true, allowed_present=false, production=true` なら、PR #19の未指定時mock条件に該当する。それ以外では、env名の不在だけから原因を断定しない。MiniにはGCP認証がないため、この実行は既存認証owner側で行う。repoの `task.sh` はjob定義を更新するため読み取り確認には使わない。

## 適用と残確認

修正はdraft PRで独立レビューと既存CIを通し、runtime確認と合わせて適用を判断する。現時点ではmerge/deployしない。7例の既存RSpecによる回帰テストは、親から必要性が合意された未指定production判定と、明示制限・test・キーなしの条件を確認し、実Geminiを呼ばない。

新しいSecret、キー入力、IAM grant、envの追加、一般利用の `*` 変更は行わない。合成画像解析1回と家具提案1回・最大US$3という限定試験の承認は、これらの新設定や無制限の生成を許可するものではない。実AI試験は既存キー経路と実モデルを確認してから既存の上限内で判断する。
