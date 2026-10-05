# GCP は使うサービスごとに API を有効化しないと何も作れない。
# cloudresourcemanager / serviceusage の 2 つだけは terraform 自身が
# API を有効化するために先に要るので、make infra-bootstrap が gcloud で有効化する。
locals {
  services = concat([
    "run.googleapis.com",              # Cloud Run
    "sqladmin.googleapis.com",         # Cloud SQL
    "artifactregistry.googleapis.com", # コンテナイメージの置き場
    "secretmanager.googleapis.com",    # SECRET_KEY_BASE などの保管
    "storage.googleapis.com",          # GCS (3D モデル・部屋写真)
    "iam.googleapis.com",
    "iamcredentials.googleapis.com", # Workload Identity
    "sts.googleapis.com",            # Workload Identity
    "logging.googleapis.com",
  ], var.gemini_provider == "vertex" ? ["aiplatform.googleapis.com"] : [])
}

resource "google_project_service" "this" {
  for_each = toset(local.services)

  service = each.value

  # terraform destroy で API まで無効化すると他で困るので残す
  disable_on_destroy = false
}
