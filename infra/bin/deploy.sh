#!/usr/bin/env bash
# compose ファイルと .env だけをインスタンスに置き、ECR から pull して起動する。
# アプリのコードはイメージの中にあるので転送しない。
set -euo pipefail

cd "$(dirname "$0")/../.."
TF=./infra/bin/tf.sh

ip=$($TF output -raw instance_ip | tr -d '\r')
key=$($TF output -raw ssh_key_path | tr -d '\r')
url=$($TF output -raw public_url | tr -d '\r')

SSH_OPTS=(-i "$key" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR)
remote="ubuntu@$ip"

printf 'インスタンスの準備を待っています'
for _ in $(seq 1 60); do
  if ssh "${SSH_OPTS[@]}" -o ConnectTimeout=5 "$remote" 'test -f /opt/app/.provisioned' 2>/dev/null; then
    echo " 完了"
    break
  fi
  printf '.'
  sleep 5
done

echo "設定を転送しています..."
ssh "${SSH_OPTS[@]}" "$remote" 'mkdir -p /opt/app/infra'
scp "${SSH_OPTS[@]}" -q compose.yaml "$remote:/opt/app/compose.yaml"
scp "${SSH_OPTS[@]}" -q infra/compose.deploy.yaml "$remote:/opt/app/infra/compose.deploy.yaml"
scp "${SSH_OPTS[@]}" -q infra/.env "$remote:/opt/app/infra/.env"

echo "ECR から pull して起動しています..."
ssh "${SSH_OPTS[@]}" "$remote" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/app
set -a; . infra/.env; set +a

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

COMPOSE="docker compose -f compose.yaml -f infra/compose.deploy.yaml --env-file infra/.env"
$COMPOSE pull api worker   # 同じイメージなので 2 回目はキャッシュが効く
$COMPOSE up -d
docker image prune -f >/dev/null
REMOTE

cat <<MSG

デプロイしました

  API        $url
  Swagger UI $url/api-docs

ログ: make infra-logs
MSG
