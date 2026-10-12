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
# クライアントは同一オリジンを使い、nginx の中継先をイメージへ設定する。
docker buildx build \
  --platform "$platform" \
  --target runtime \
  --build-arg "VITE_API_ENDPOINT=" \
  --build-arg "API_UPSTREAM_ORIGIN=$api_url" \
  --build-arg "VITE_CONNECTION=api" \
  --build-arg "VITE_TERMS_URL=${VITE_TERMS_URL:-}" \
  --build-arg "VITE_PRIVACY_URL=${VITE_PRIVACY_URL:-}" \
  -t "$web_repo:$tag" -t "$web_repo:latest" \
  --push \
  "$ROOT/frontend"

echo
echo "== 2/3 db/Schemafile を Cloud SQL に適用します"
# 新しいイメージでスキーマを当ててから、下でサービスを差し替える
"$(dirname "$0")/task.sh" furniture_texture:clear_legacy,db:apply,character:import,furniture:import,furniture_texture:import,furniture_detail:import "$api_repo:$tag"

echo
echo "== 3/3 Cloud Run を更新します"
# Use a separator absent from the values so URL query commas remain intact.
legal_separator="__LEGAL_DOCUMENTS__"
while [[ "${VITE_TERMS_URL:-}${VITE_PRIVACY_URL:-}" == *"$legal_separator"* ]]; do
  legal_separator="${legal_separator}_"
done
legal_env="^${legal_separator}^VITE_TERMS_URL=${VITE_TERMS_URL:-}${legal_separator}VITE_PRIVACY_URL=${VITE_PRIVACY_URL:-}"
gcloud run services update "$api_service" \
  --update-env-vars "$legal_env" \
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
