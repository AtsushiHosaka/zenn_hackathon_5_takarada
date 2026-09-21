#!/usr/bin/env bash
# terraform の出力を GitHub Secrets に登録する (CI/CD を有効にする)。
# gh CLI で認証済みである必要がある: gh auth login
set -euo pipefail

cd "$(dirname "$0")/../.."
TF=./infra/bin/tf.sh

command -v gh >/dev/null || { echo "gh CLI が必要です: https://cli.github.com/" >&2; exit 1; }

role=$($TF output -raw github_actions_role_arn | tr -d '\r')
if [ -z "$role" ]; then
  echo "github_actions_role_arn が空です。" >&2
  echo "infra/terraform/terraform.tfvars の github_repository に owner/repo を入れて" >&2
  echo "make infra-apply を実行し直してください。" >&2
  exit 1
fi

key=$($TF output -raw ssh_key_path | tr -d '\r')

set_secret() { echo "  $1"; gh secret set "$1" --body "$2" >/dev/null; }

echo "GitHub Secrets を設定しています..."
set_secret AWS_ROLE_ARN        "$role"
set_secret AWS_REGION          "$($TF output -raw region | tr -d '\r')"
set_secret ECR_REPOSITORY_URL  "$($TF output -raw ecr_repository_url | tr -d '\r')"
set_secret LIGHTSAIL_HOST      "$($TF output -raw instance_ip | tr -d '\r')"
set_secret PUBLIC_URL          "$($TF output -raw public_url | tr -d '\r')"

echo "  SSH_PRIVATE_KEY"
gh secret set SSH_PRIVATE_KEY < "$key"

echo
echo "完了しました。main にマージすると CI のあと自動でデプロイされます。"
