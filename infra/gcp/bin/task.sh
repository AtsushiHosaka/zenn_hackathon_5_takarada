#!/usr/bin/env bash
# Cloud Run のジョブで rails のタスクを 1 回流す。
#
#   ./task.sh db:apply          … db/Schemafile を Cloud SQL に適用
#   ./task.sh db:seed           … デモデータを入れる
#   ./task.sh db:dry_run        … 差分だけ見る
#
# 第 2 引数以降にイメージを指定できる (デプロイ時に新しいタグで流すため)。
source "$(dirname "$0")/lib.sh"

need_tools
require_tfvars

task="${1:-}"
[ -n "$task" ] || die "流す rails タスクを渡してください (例: ./task.sh db:apply)"
image="${2:-}"

job="$(tfout task_job)"
region="$(tfout region)"
project_id="$(tfout project_id)"

args=(--args "$task" --region "$region" --project "$project_id" --quiet)
[ -n "$image" ] && args+=(--image "$image")

echo "ジョブ $job に rails $task を設定します"
gcloud run jobs update "$job" "${args[@]}"

echo "実行します (ログは下に出ます)"
gcloud run jobs execute "$job" --region "$region" --project "$project_id" --wait
