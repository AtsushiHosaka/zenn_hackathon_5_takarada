#!/usr/bin/env bash
# terraform をコンテナで実行する。ホストへのインストールは不要。
# AWS の認証情報は ~/.aws と環境変数の両方から引き継ぐ。
set -euo pipefail

cd "$(dirname "$0")/../.."

args=()
[ -d "$HOME/.aws" ] && args+=(-v "$HOME/.aws:/root/.aws:ro")
for v in AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN \
         AWS_REGION AWS_DEFAULT_REGION; do
  [ -n "${!v:-}" ] && args+=(-e "$v=${!v}")
done

# infra/ ごとマウントする。terraform が infra/.ssh に秘密鍵を書き出すため
exec docker run --rm \
  -v "$PWD/infra:/infra" \
  -w /infra/terraform \
  "${args[@]}" \
  hashicorp/terraform:latest "$@"
