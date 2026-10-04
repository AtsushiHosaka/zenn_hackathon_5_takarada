# コンテナイメージの置き場 (AWS の ECR に相当)。
# push 先は <region>-docker.pkg.dev/<project_id>/<repo>/<image>:<tag>
resource "google_artifact_registry_repository" "app" {
  repository_id = var.project
  location      = var.region
  format        = "DOCKER"
  description   = "${var.project} のコンテナイメージ"

  # タグの付いていない古いイメージを 7 日で消す。放置すると保管料がかさむだけなので
  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s"
    }
  }

  depends_on = [google_project_service.this]
}
