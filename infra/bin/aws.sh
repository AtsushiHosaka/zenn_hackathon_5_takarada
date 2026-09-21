#!/usr/bin/env bash
# AWS CLI をコンテナで実行する。ホストへのインストールは不要。
set -euo pipefail

cd "$(dirname "$0")/../.."

args=()
[ -d "$HOME/.aws" ] && args+=(-v "$HOME/.aws:/root/.aws:ro")
for v in AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN \
         AWS_REGION AWS_DEFAULT_REGION; do
  [ -n "${!v:-}" ] && args+=(-e "$v=${!v}")
done

exec docker run --rm "${args[@]}" amazon/aws-cli:latest "$@"
