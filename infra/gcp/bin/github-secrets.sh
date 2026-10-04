#!/usr/bin/env bash
# terraform の出力を GitHub Secrets に登録して CI/CD を有効にする。
# gh CLI で認証済みである必要がある: gh auth login
source "$(dirname "$0")/lib.sh"

need gh "https://cli.github.com/"
require_tfvars

provider="$(terraform -chdir="$TFDIR" output -raw wif_provider 2>/dev/null | tr -d '\r' || true)"
if [ -z "$provider" ]; then
  die "wif_provider が空です。infra/gcp/terraform.tfvars の github_repository に owner/repo を入れて make infra-apply を実行し直してください。"
fi

set_secret() { echo "  $1"; gh secret set "$1" --body "$2" >/dev/null; }

echo "GitHub Secrets を設定しています..."
set_secret GCP_WIF_PROVIDER     "$provider"
set_secret GCP_SERVICE_ACCOUNT  "$(tfout gha_service_account)"
set_secret GCP_PROJECT_ID       "$(tfout project_id)"
set_secret GCP_REGION           "$(tfout region)"
set_secret GCP_API_IMAGE_REPO   "$(tfout api_image_repo)"
set_secret GCP_WEB_IMAGE_REPO   "$(tfout web_image_repo)"
set_secret GCP_API_SERVICE      "$(tfout api_service)"
set_secret GCP_WEB_SERVICE      "$(tfout web_service)"
set_secret GCP_TASK_JOB         "$(tfout task_job)"
set_secret GCP_API_URL          "$(tfout api_url)"

cat <<MSG

完了しました。main にマージすると CI のあと自動でデプロイされます。
MSG
