#!/usr/bin/env bash
# GCP 側のリソースを全部消す。Cloud SQL のデータも消えるので注意。
source "$(dirname "$0")/lib.sh"

need_tools
require_tfvars

echo "次のリソースを削除します:"
echo "  Cloud Run (api / web / db-apply ジョブ)"
echo "  Cloud SQL $(tfout db_connection_name) ... データも消えます"
echo "  Artifact Registry / Secret Manager / Workload Identity"
echo
read -r -p "本当に削除しますか? (yes と入力): " answer
[ "$answer" = "yes" ] || die "中止しました。"

tf destroy -auto-approve -input=false
