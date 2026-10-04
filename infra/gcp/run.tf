# Cloud Run のサービスアカウント。API 本体と db:apply ジョブが共有する。
# 権限は「Cloud SQL に繋ぐ」「自分の Secret を読む」の 2 つだけ。
resource "google_service_account" "api" {
  account_id   = "${var.project}-api"
  display_name = "${var.project} Cloud Run (API)"
}

resource "google_project_iam_member" "api_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api.email}"
}

locals {
  # Cloud SQL コネクタが掘る Unix ソケット。libpq は "/" 始まりの host を
  # ソケットディレクトリとして扱うので、Rails の DB_HOST にそのまま渡せる
  db_socket = "/cloudsql/${google_sql_database_instance.main.connection_name}"

  # API コンテナと db:apply ジョブで共通の環境変数
  app_env = {
    RAILS_ENV         = "production"
    RAILS_LOG_LEVEL   = "info"
    RAILS_MAX_THREADS = "5"
    DB_HOST           = local.db_socket
    DB_PORT           = "5432"
    DB_NAME           = var.db_name
    DB_USERNAME       = google_sql_user.app.name
  }

  # 空なら Web フロントの Cloud Run URL だけを許可する
  cors_origins = var.cors_origins != "" ? var.cors_origins : google_cloud_run_v2_service.web.uri
}

# --- API (Rails) --------------------------------------------------------------

resource "google_cloud_run_v2_service" "api" {
  name     = "${var.project}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  # ハッカソン用。make infra-destroy で消せるようにしてある
  deletion_protection = false

  template {
    service_account = google_service_account.api.email

    # puma のスレッド数 (RAILS_MAX_THREADS = 5) に合わせる。
    # 既定の 80 のままだと 1 インスタンスに 80 本流れてキューで詰まる
    max_instance_request_concurrency = 10

    scaling {
      # アクセスが無いとゼロまで縮む (= 課金されない)。
      # 初回アクセスのコールドスタートが気になるなら min を 1 にする
      min_instance_count = 0
      max_instance_count = var.api_max_instances
    }

    # Cloud SQL コネクタ。これを挿すと /cloudsql/<接続名> にソケットが生える
    volumes {
      name = "cloudsql"

      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.api_image

      # backend/Dockerfile の CMD が 3000 で待ち受ける。
      # Cloud Run は PORT 環境変数にこの値を入れて渡す
      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        # リクエストを処理していない間は CPU を止める (課金を抑える)
        cpu_idle          = true
        startup_cpu_boost = true
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      dynamic "env" {
        for_each = local.app_env

        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name  = "CORS_ORIGINS"
        value = local.cors_origins
      }

      dynamic "env" {
        for_each = local.env_from_secret

        content {
          name = env.key

          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.value].secret_id
              version = "latest"
            }
          }
        }
      }

      # Rails の /up が 200 を返したら起動完了とみなす
      startup_probe {
        initial_delay_seconds = 10
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 12

        http_get {
          path = "/up"
          port = 3000
        }
      }
    }
  }

  # イメージの差し替えは make infra-release (gcloud run deploy) の担当。
  # terraform はインフラの形だけを見て、動いているタグには触らない
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.this,
    google_secret_manager_secret_version.app,
    google_secret_manager_secret_iam_member.api,
    google_project_iam_member.api_cloudsql,
  ]
}

# --- Web フロント (nginx + ビルド済みの静的ファイル) --------------------------

resource "google_cloud_run_v2_service" "web" {
  name     = "${var.project}-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = var.web_max_instances
    }

    containers {
      image = var.web_image

      # frontend/Dockerfile の runtime ステージ (nginx) が 80 で待ち受ける
      ports {
        container_port = 80
      }

      # 第 2 世代の実行環境は 512Mi 以上を要求するので、nginx には過剰でもここは下げない
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [google_project_service.this]
}

# --- 公開設定 -----------------------------------------------------------------
# Cloud Run は既定で非公開なので、誰でも叩けるように invoker を allUsers に開ける

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  name     = google_cloud_run_v2_service.web.name
  location = google_cloud_run_v2_service.web.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- rails タスク実行ジョブ ---------------------------------------------------
# API と同じイメージ・同じ環境変数で、rails のタスクだけを 1 回流す入れ物。
# 既定の引数は db:apply (ridgepole で db/Schemafile を Cloud SQL に適用)。
# make infra-db-apply / make infra-seed / make infra-task が args を差し替えて実行する。

resource "google_cloud_run_v2_job" "task" {
  name     = "${var.project}-task"
  location = var.region

  deletion_protection = false

  template {
    template {
      service_account = google_service_account.api.email
      max_retries     = 1
      timeout         = "600s"

      volumes {
        name = "cloudsql"

        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }

      containers {
        image   = var.api_image
        command = ["bundle", "exec", "rails"]
        args    = ["db:apply"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }

        dynamic "env" {
          for_each = local.app_env

          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = local.env_from_secret

          content {
            name = env.key

            value_source {
              secret_key_ref {
                secret  = google_secret_manager_secret.app[env.value].secret_id
                version = "latest"
              }
            }
          }
        }
      }
    }
  }

  # イメージと引数は実行するスクリプト側 (gcloud run jobs update) が決める。
  # terraform は入れ物の形だけを管理する
  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
      template[0].template[0].containers[0].args,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_project_service.this,
    google_secret_manager_secret_version.app,
    google_secret_manager_secret_iam_member.api,
    google_project_iam_member.api_cloudsql,
    google_sql_database.app,
    google_sql_user.app,
  ]
}
