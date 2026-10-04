output "api_url" {
  description = "API の公開 URL (HTTPS は Cloud Run が自動で付ける)"
  value       = google_cloud_run_v2_service.api.uri
}

output "web_url" {
  description = "Web フロントの公開 URL"
  value       = google_cloud_run_v2_service.web.uri
}

output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

# --- イメージの push 先 -------------------------------------------------------

output "registry" {
  description = "docker login の対象 (gcloud auth configure-docker に渡す)"
  value       = "${var.region}-docker.pkg.dev"
}

output "api_image_repo" {
  description = "API イメージの push 先 (タグ無し)"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}/api"
}

output "web_image_repo" {
  description = "Web フロントイメージの push 先 (タグ無し)"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}/web"
}

# --- Cloud Run / Cloud SQL ----------------------------------------------------

output "api_service" {
  value = google_cloud_run_v2_service.api.name
}

output "web_service" {
  value = google_cloud_run_v2_service.web.name
}

output "task_job" {
  description = "rails のタスクを 1 回流す Cloud Run ジョブ名"
  value       = google_cloud_run_v2_job.task.name
}

output "db_connection_name" {
  description = "Cloud SQL の接続名 (<project>:<region>:<instance>)"
  value       = google_sql_database_instance.main.connection_name
}

output "db_instance" {
  value = google_sql_database_instance.main.name
}

output "db_database" {
  description = "実際に作られたデータベース名"
  value       = google_sql_database.app.name
}

output "db_username" {
  value = google_sql_user.app.name
}

output "run_service_account" {
  description = "Cloud Run が名乗るサービスアカウント"
  value       = google_service_account.api.email
}

# --- GitHub Actions -----------------------------------------------------------

output "wif_provider" {
  description = "google-github-actions/auth の workload_identity_provider に渡す値"
  value       = local.gh_enabled ? google_iam_workload_identity_pool_provider.github[0].name : ""
}

output "gha_service_account" {
  description = "google-github-actions/auth の service_account に渡す値"
  value       = local.gh_enabled ? google_service_account.github_actions[0].email : ""
}

# --- 秘密の値 (必要なときだけ terraform output -raw で取り出す) ----------------

output "secret_key_base" {
  value     = local.app_secrets["secret-key-base"]
  sensitive = true
}

output "devise_jwt_secret_key" {
  value     = local.app_secrets["devise-jwt-key"]
  sensitive = true
}

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}

output "console_url" {
  description = "GCP コンソール (Cloud Run の一覧)"
  value       = "https://console.cloud.google.com/run?project=${var.project_id}"
}
