# 本番モードで動かすために必要な鍵。Secret Manager に置き、Cloud Run が
# 環境変数として読み込む。値を固定したい場合は terraform.tfvars で上書きする。
#
# 注意: terraform.tfstate には平文で入るので state は共有しない (.gitignore 済み)。
resource "random_id" "secret_key_base" {
  byte_length = 64
}

resource "random_id" "devise_jwt_secret" {
  byte_length = 64
}

locals {
  app_secrets = {
    "secret-key-base" = var.secret_key_base != "" ? var.secret_key_base : random_id.secret_key_base.hex
    "devise-jwt-key"  = var.devise_jwt_secret_key != "" ? var.devise_jwt_secret_key : random_id.devise_jwt_secret.hex
    "db-password"     = random_password.db.result
  }

  # Cloud Run の環境変数名 -> Secret Manager の secret_id
  env_from_secret = {
    SECRET_KEY_BASE       = "secret-key-base"
    DEVISE_JWT_SECRET_KEY = "devise-jwt-key"
    DB_PASSWORD           = "db-password"
  }
}

resource "google_secret_manager_secret" "app" {
  for_each = local.app_secrets

  secret_id = "${var.project}-${each.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.this]
}

resource "google_secret_manager_secret_version" "app" {
  for_each = local.app_secrets

  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value
}

# Cloud Run のサービスアカウントにだけ読み取りを許す
resource "google_secret_manager_secret_iam_member" "api" {
  for_each = local.app_secrets

  secret_id = google_secret_manager_secret.app[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

# 既存Secretへの参照だけを管理する。Geminiキーの値・Secret本体・versionは作らず、
# 指定された1つのSecretにだけ既存APIアカウントの読み取りを許可する。
resource "google_secret_manager_secret_iam_member" "gemini_api" {
  count = var.gemini_api_key_secret_id != "" && var.gemini_grant_secret_access ? 1 : 0

  project   = var.project_id
  secret_id = var.gemini_api_key_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}
