#!/usr/bin/env bash
# イメージをビルドして Artifact Registry に push し、Cloud Run に反映する。
#
#   1. backend / frontend のイメージをビルドして push
#   2. db/Schemafile を Cloud SQL に適用 (Cloud Run ジョブ)
#   3. Cloud Run の api / web を新しいイメージに更新
#
# スキーマを先に当ててから新しいコードを出す順番にしている。
source "$(dirname "$0")/lib.sh"

need_tools
require_tfvars

project_id="$(tfout project_id)"
region="$(tfout region)"
api_repo="$(tfout api_image_repo)"
web_repo="$(tfout web_image_repo)"
api_url="$(tfout api_url)"
api_service="$(tfout api_service)"
web_service="$(tfout web_service)"

tag="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
# Cloud Run は x86_64 なので、Apple Silicon からはクロスビルドする
platform="${IMAGE_PLATFORM:-linux/amd64}"

gcloud auth configure-docker "${region}-docker.pkg.dev" --quiet

echo "== 1/3 イメージをビルドして push します ($platform, タグ $tag)"

echo "-- API"
docker buildx build \
  --platform "$platform" \
  -t "$api_repo:$tag" -t "$api_repo:latest" \
  --push \
  "$ROOT/backend"

echo "-- Web フロント"
# VITE_ で始まる値はビルド時にバンドルへ埋め込まれる。
# フロントが叩く API の URL はここで固定される
docker buildx build \
  --platform "$platform" \
  --target runtime \
  --build-arg "VITE_API_ENDPOINT=$api_url" \
  --build-arg "VITE_CONNECTION=api" \
  -t "$web_repo:$tag" -t "$web_repo:latest" \
  --push \
  "$ROOT/frontend"

echo
echo "== 2/3 db/Schemafile を Cloud SQL に適用します"
# 新しいイメージでスキーマを当ててから、下でサービスを差し替える
"$(dirname "$0")/task.sh" db:apply,furniture_models:import "$api_repo:$tag"

echo
echo "== 3/3 Cloud Run を更新します"
gcloud run services update "$api_service" \
  --image "$api_repo:$tag" \
  --region "$region" --project "$project_id" --quiet
gcloud run services update "$web_service" \
  --image "$web_repo:$tag" \
  --region "$region" --project "$project_id" --quiet

cat <<MSG

デプロイしました (タグ $tag)

  API           $api_url
  Web フロント  $(tfout web_url)

動作確認

  curl $api_url/up
MSG
