#!/usr/bin/env bash
# GCP 側のリソースを作る / 差分を反映する。
# 初回は Cloud SQL の作成に 5〜10 分かかる。
source "$(dirname "$0")/lib.sh"

need_tools
require_tfvars

tf init -input=false
tf apply -auto-approve -input=false

region="$(tfout region)"

# docker push 先として Artifact Registry を信用させる (何度やっても害はない)
gcloud auth configure-docker "${region}-docker.pkg.dev" --quiet

cat <<MSG

作成しました

  API           $(tfout api_url)
  Web フロント  $(tfout web_url)
  Cloud SQL     $(tfout db_connection_name)
  コンソール    $(tfout console_url)

この時点では Cloud Run は Google のサンプルイメージが動いています。
次に make infra-release を実行すると、自分のイメージに置き換わります。
MSG
