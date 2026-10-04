# 各スクリプトが source する共通処理。単体では実行しない。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TFDIR="$ROOT/infra/gcp"

die() { echo "エラー: $*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null || die "$1 が必要です。$2"
}

need_tools() {
  need gcloud "brew install --cask google-cloud-sdk"
  need terraform "brew install terraform"
  need docker "https://www.docker.com/products/docker-desktop/"
}

tf() { terraform -chdir="$TFDIR" "$@"; }

# 出力を 1 つ取り出す。state が無い / 値が空ならエラーにする
tfout() {
  local v
  v="$(terraform -chdir="$TFDIR" output -raw "$1" 2>/dev/null | tr -d '\r')" \
    || die "terraform の出力 '$1' が読めません。make infra-apply を先に実行してください。"
  [ -n "$v" ] || die "terraform の出力 '$1' が空です。"
  printf '%s' "$v"
}

require_tfvars() {
  [ -f "$TFDIR/terraform.tfvars" ] \
    || die "infra/gcp/terraform.tfvars がありません。先に make infra-bootstrap を実行してください。"
}
