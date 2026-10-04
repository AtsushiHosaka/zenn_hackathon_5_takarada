# GCS のバケット。公開 / 非公開の境界はバケットの境界になる。
#
# uniform bucket-level access では allUsers を付けるとバケット全体が公開になり、
# prefix 単位で公開範囲を分けられない。そのため 2 つに分ける。
#
#   models  … 3D モデル (GLB)。誰でも読める。ブラウザが直接取りに行く
#   uploads … 部屋の写真。api のサービスアカウントだけが触れる

resource "google_storage_bucket" "models" {
  name     = "${var.project_id}-models"
  location = var.region

  # 公開範囲はバケット単位の IAM だけで決める (オブジェクト ACL は使わない)
  uniform_bucket_level_access = true

  # ハッカソン用。make infra-destroy で中身ごと消せるようにしてある
  force_destroy = true

  # three.js の GLTFLoader はクロスオリジンで fetch するので CORS が要る。
  # 中身は公開モデルなので origin は絞らない
  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.this]
}

resource "google_storage_bucket" "uploads" {
  name     = "${var.project_id}-uploads"
  location = var.region

  uniform_bucket_level_access = true
  force_destroy               = true

  # ブラウザが署名付き URL へ直接 PUT する。
  # 署名した Content-Type と送られる Content-Type が一致しないと GCS が 403 を返すので、
  # クライアントは Content-Type だけを付けて余計なヘッダを足さないこと
  cors {
    origin          = concat(split(",", local.cors_origins), ["http://localhost:5173"])
    method          = ["PUT", "OPTIONS"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  # 写真は解析で 1 回読まれたら用済み (シーン JSON が成果物) なので短く捨てる。
  # アップロードしたまま離脱した孤児オブジェクトもこれで消える
  lifecycle_rule {
    condition {
      age = 7
    }

    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.this]
}

# --- 権限 ---------------------------------------------------------------------

# モデルは誰でも読める。書き込みは release 時の人間 / CI だけなので付けない
resource "google_storage_bucket_iam_member" "models_public" {
  bucket = google_storage_bucket.models.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# api は写真を読み書きする (署名付き URL の発行・存在確認・解析時の読み出し)。
# プロジェクト全体ではなくこのバケットだけに付ける
resource "google_storage_bucket_iam_member" "uploads_api" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

# api がモデルの URL を組むだけなら権限は要らないが、
# ModelResolver が存在確認をするので読み取りだけ付けておく
resource "google_storage_bucket_iam_member" "models_api" {
  bucket = google_storage_bucket.models.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.api.email}"
}

# Cloud Run のサービスアカウントは秘密鍵を持たない (メタデータサーバ経由の認証) ため、
# 署名付き URL の署名を自分で計算できない。IAM の signBlob に委譲するので、
# **自分自身に対する** トークン作成権限が必要になる。
# これが無いと署名時に 403 (iam.serviceAccounts.signBlob) で落ちる
resource "google_service_account_iam_member" "api_sign_blob" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.api.email}"
}
