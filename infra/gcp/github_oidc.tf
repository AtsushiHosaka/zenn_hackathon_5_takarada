# GitHub Actions から GCP を触るための Workload Identity。
# サービスアカウントキー (JSON) を GitHub に置かずに、GitHub が発行する OIDC
# トークンを GCP 側で検証して短命の資格情報に交換する。AWS の OIDC ロールと同じ考え方。
#
# github_repository が空なら何も作らない。
locals {
  gh_enabled = var.github_repository != ""
}

resource "google_iam_workload_identity_pool" "github" {
  count = local.gh_enabled ? 1 : 0

  workload_identity_pool_id = "${var.project}-github"
  display_name              = "GitHub Actions"
  description               = "${var.github_repository} からの OIDC を受ける"

  depends_on = [google_project_service.this]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count = local.gh_enabled ? 1 : 0

  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  # このリポジトリ以外のトークンは入口で弾く。これが無いと
  # 全世界の GitHub Actions から交換できてしまうので必須
  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_actions" {
  count = local.gh_enabled ? 1 : 0

  account_id   = "${var.project}-gha"
  display_name = "${var.project} GitHub Actions"
}

# 上のリポジトリから来たトークンだけが、このサービスアカウントになれる
resource "google_service_account_iam_member" "github_actions_wif" {
  count = local.gh_enabled ? 1 : 0

  service_account_id = google_service_account.github_actions[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repository}"
}

# イメージの push と Cloud Run の更新に必要な権限
resource "google_project_iam_member" "github_actions" {
  for_each = local.gh_enabled ? toset([
    "roles/artifactregistry.writer", # イメージを push する
    "roles/run.admin",               # Cloud Run のサービス更新 / ジョブ実行
  ]) : toset([])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_actions[0].email}"
}

# Cloud Run はリビジョンを作るたびに、実行するサービスアカウントへの
# iam.serviceAccountUser を要求する。api と web の 2 つに対してだけ与える
# (プロジェクト全体には与えない)。これが無いと CI のデプロイが権限エラーになる。
resource "google_service_account_iam_member" "github_actions_act_as" {
  for_each = local.gh_enabled ? {
    api = google_service_account.api.name
    web = google_service_account.web.name
  } : {}

  service_account_id = each.value
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions[0].email}"
}
