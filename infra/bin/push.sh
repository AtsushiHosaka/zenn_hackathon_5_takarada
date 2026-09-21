#!/usr/bin/env bash
# backend のイメージをビルドして ECR に push する。
set -euo pipefail

cd "$(dirname "$0")/../.."
TF=./infra/bin/tf.sh
AWS=./infra/bin/aws.sh

repo=$($TF output -raw ecr_repository_url | tr -d '\r')
registry=$($TF output -raw ecr_registry | tr -d '\r')
region=$($TF output -raw region | tr -d '\r')

# Lightsail は x86_64 なので、Apple Silicon から push する場合もクロスビルドする
platform=${IMAGE_PLATFORM:-linux/amd64}
tag=${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}

echo "ECR にログインしています..."
$AWS ecr get-login-password --region "$region" \
  | docker login --username AWS --password-stdin "$registry"

echo "ビルドして push しています ($platform)..."
docker buildx build \
  --platform "$platform" \
  -t "$repo:$tag" \
  -t "$repo:latest" \
  --push \
  ./backend

echo
echo "push しました: $repo:$tag"
