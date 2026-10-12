# AI で家具の 3D モデルを作るジョブ (管理画面の「3Dモデルを作る」)。
#
#   API  --(依頼 request.json を置く / ジョブを起動)-->  model-builder ジョブ
#   API  <--(結果 result.json・GLB・確認用の画像を読む)--  builds バケット
#
# ジョブは AI が書いたコードを実行するので、API とは別のサービスアカウントにして権限を絞る。
# 持つのは builds バケットの読み書きと Vertex AI の呼び出しだけ。Cloud SQL・Secret・ほかのバケットには触れない。
# イメージは tools/furniture_models/generator/Dockerfile。リリース時にビルドして差し替える (make infra-release / deploy.yml)。
# Vertex AI を使うので、gemini_provider = "vertex" のプロジェクトで使う (aiplatform の API が有効になっていること)。

variable "model_builder_image" {
  description = "3D モデルを作るジョブのイメージ。既定値の扱いは api_image と同じ (リリースが差し替える)"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "model_generation_model" {
  description = "3D モデルの定義を書かせる Gemini のモデル。アプリ本体の gemini_model (軽いモデル) では形を組み立てきれない"
  type        = string
  default     = "gemini-3.1-pro-preview"
}

resource "google_service_account" "model_builder" {
  account_id   = "${var.project}-model-builder"
  display_name = "${var.project} Cloud Run (3D モデルを作るジョブ)"
}

# 依頼と結果の置き場。非公開。採用した GLB だけを API が models バケットへ複製する
resource "google_storage_bucket" "model_builds" {
  name     = "${var.project_id}-model-builds"
  location = var.region

  uniform_bucket_level_access = true
  force_destroy               = true

  # 採用しなかった生成物をためない
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.this]
}

resource "google_storage_bucket_iam_member" "model_builds_builder" {
  bucket = google_storage_bucket.model_builds.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.model_builder.email}"
}

resource "google_storage_bucket_iam_member" "model_builds_api" {
  bucket = google_storage_bucket.model_builds.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

# 採用した GLB を公開バケットへ置く (既存のファイルは上書きしない)
resource "google_storage_bucket_iam_member" "models_api_create" {
  bucket = google_storage_bucket.models.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "model_builder_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.model_builder.email}"
}

resource "google_cloud_run_v2_job" "model_builder" {
  name     = "${var.project}-model-builder"
  location = var.region

  deletion_protection = false

  template {
    template {
      service_account = google_service_account.model_builder.email
      # 失敗は result.json に残すので、やり直さない (AI の呼び出しを重ねない)
      max_retries = 0
      timeout     = "900s"

      containers {
        image = var.model_builder_image

        # Blender の部品の読み込みと Cycles の CPU 描画に使う。GPU は要らない
        resources {
          limits = {
            cpu    = "2"
            memory = "4Gi"
          }
        }

        env {
          name  = "GOOGLE_CLOUD_PROJECT"
          value = var.project_id
        }
        env {
          name  = "MODEL_GENERATION_MODEL"
          value = var.model_generation_model
        }
        # GENERATION_URI (置き場のパス) は、API が実行のたびに上書きで渡す
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [google_project_service.this]
}

# API が、置き場のパスを環境変数で上書きしてジョブを実行する
resource "google_cloud_run_v2_job_iam_member" "model_builder_api" {
  name     = google_cloud_run_v2_job.model_builder.name
  location = google_cloud_run_v2_job.model_builder.location
  role     = "roles/run.jobsExecutorWithOverrides"
  member   = "serviceAccount:${google_service_account.api.email}"
}

output "model_builder_job" {
  description = "3D モデルを作る Cloud Run ジョブ名"
  value       = google_cloud_run_v2_job.model_builder.name
}

output "model_builder_image_repo" {
  description = "3D モデルを作るジョブのイメージの push 先 (タグ無し)"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}/model-builder"
}
