#!/usr/bin/env bash
# GCP を使い始めるための一度だけの準備。対話で進む。
#
#   1. gcloud にログイン
#   2. プロジェクトを選ぶ (または作る)
#   3. 請求先アカウントを紐付ける
#   4. terraform が API を有効化できるよう、最低限の API を開ける
#   5. terraform 用の認証情報 (ADC) を取る
#   6. infra/gcp/terraform.tfvars を書く
#
# 何度実行しても壊れない (冪等) ように書いてある。
source "$(dirname "$0")/lib.sh"

need_tools

echo "== 1. gcloud のログイン状態を確認します"
if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q . \
   || ! gcloud projects list --limit=1 >/dev/null 2>&1; then
  echo "   ブラウザが開きます。Google アカウントでログインしてください。"
  gcloud auth login
fi
account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
echo "   ログイン中: $account"

echo
echo "== 2. プロジェクトを選びます"
gcloud projects list --format='table(projectId, name, projectNumber)' || true
echo
echo "   使うプロジェクト ID を入力してください。"
echo "   新しく作る場合は、まだ存在しない ID を入れると作成します"
echo "   (世界で一意・小文字と数字とハイフン・6〜30文字)。"
read -r -p "   プロジェクト ID: " project_id
[ -n "$project_id" ] || die "プロジェクト ID が空です。"

if gcloud projects describe "$project_id" >/dev/null 2>&1; then
  echo "   既存のプロジェクトを使います: $project_id"
else
  echo "   プロジェクトを作成します: $project_id"
  gcloud projects create "$project_id" --name="$project_id"
fi

gcloud config set project "$project_id" >/dev/null
echo "   gcloud の既定プロジェクトを $project_id にしました"

echo
echo "== 3. 請求先アカウントを確認します"
# Cloud Run も Cloud SQL も、請求先が紐付いていないと作成できない
billing="$(gcloud billing projects describe "$project_id" \
  --format='value(billingAccountName)' 2>/dev/null || true)"
if [ -n "$billing" ]; then
  echo "   紐付け済み: $billing"
else
  echo "   このプロジェクトには請求先が紐付いていません。候補:"
  gcloud billing accounts list --format='table(name, displayName, open)' 2>/dev/null || true
  echo
  echo "   請求先アカウント ID (例 01ABCD-234567-89EFGH) を入れてください。"
  echo "   空のまま Enter を押すと、ブラウザで手動で紐付ける前提でスキップします。"
  read -r -p "   請求先アカウント ID: " billing_id
  if [ -n "$billing_id" ]; then
    gcloud billing projects link "$project_id" --billing-account="$billing_id"
  else
    echo "   スキップしました。次の URL で紐付けてから、もう一度このコマンドを実行してください:"
    echo "   https://console.cloud.google.com/billing/linkedaccount?project=$project_id"
  fi
fi

echo
echo "== 4. terraform が他の API を有効化するために必要な API を開けます"
# この 2 つだけは terraform より先に有効化しておく必要がある (鶏と卵)
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  --project="$project_id"
echo "   有効化しました"

echo
echo "== 5. terraform 用の認証情報 (ADC) を取ります"
# gcloud auth login はコマンド用、terraform が読むのは別の
# 「アプリケーションのデフォルト認証情報」なので両方必要
if [ -f "$HOME/.config/gcloud/application_default_credentials.json" ]; then
  echo "   既にあります。取り直す場合は手動で:"
  echo "   gcloud auth application-default login"
else
  echo "   もう一度ブラウザが開きます。同じアカウントで許可してください。"
  gcloud auth application-default login
fi
gcloud auth application-default set-quota-project "$project_id" >/dev/null 2>&1 || true

echo
echo "== 6. infra/gcp/terraform.tfvars を用意します"
if [ -f "$TFDIR/terraform.tfvars" ]; then
  echo "   既にあるので触りません: infra/gcp/terraform.tfvars"
  echo "   project_id が $project_id になっているか確認してください。"
else
  sed "s|^project_id = .*|project_id = \"$project_id\"|" \
    "$TFDIR/terraform.tfvars.example" > "$TFDIR/terraform.tfvars"
  echo "   書きました: infra/gcp/terraform.tfvars (project_id = $project_id)"
  echo "   github_repository を自分のリポジトリに直してください (CI/CD を使う場合)。"
fi

cat <<MSG

準備ができました。

  アカウント    $account
  プロジェクト  $project_id

次にやること

  1. infra/gcp/terraform.tfvars の github_repository を確認する
  2. make infra-apply     … GCP 側にリソースを作る (5〜10 分かかる)
  3. make infra-release   … イメージをビルドして push し、デプロイする
MSG
