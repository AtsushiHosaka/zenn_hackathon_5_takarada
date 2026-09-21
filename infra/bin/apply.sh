#!/usr/bin/env bash
# Lightsail インスタンスと API Gateway を作り、接続情報を infra/.env に書き出す。
set -euo pipefail

cd "$(dirname "$0")/../.."
TF=./infra/bin/tf.sh

$TF init -input=false
$TF apply -auto-approve -input=false

url=$($TF output -raw public_url | tr -d '\r')
ip=$($TF output -raw instance_ip | tr -d '\r')
key=$($TF output -raw ssh_key_path | tr -d '\r')
secret=$($TF output -raw origin_secret | tr -d '\r')
skb=$($TF output -raw secret_key_base | tr -d '\r')
jwt=$($TF output -raw devise_jwt_secret_key | tr -d '\r')
repo=$($TF output -raw ecr_repository_url | tr -d '\r')
registry=$($TF output -raw ecr_registry | tr -d '\r')
region=$($TF output -raw region | tr -d '\r')
akid=$($TF output -raw ecr_puller_access_key_id | tr -d '\r')
asak=$($TF output -raw ecr_puller_secret_access_key | tr -d '\r')

umask 077
cat > infra/.env <<ENV
# 起動するイメージ。特定のタグに戻したいときはここを書き換えて make infra-deploy
API_IMAGE=$repo:latest

SECRET_KEY_BASE=$skb
DEVISE_JWT_SECRET_KEY=$jwt
ORIGIN_SECRET=$secret

# インスタンスが ECR から pull するための情報
AWS_REGION=$region
ECR_REGISTRY=$registry
AWS_ACCESS_KEY_ID=$akid
AWS_SECRET_ACCESS_KEY=$asak
ENV
chmod 600 "$key" 2>/dev/null || true

cat <<MSG

作成しました

  API        $url
  Lightsail  $ip
  SSH        ssh -i $key ubuntu@$ip

次は make infra-release (ビルド -> ECR へ push -> デプロイ) を実行します。
MSG
