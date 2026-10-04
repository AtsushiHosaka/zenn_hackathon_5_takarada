# PostgreSQL 16。Cloud Run からは「Cloud SQL コネクタ」経由で Unix ソケットとして
# 繋ぐので、VPC も NAT も要らない。パブリック IP は付くが認可ネットワークを
# 一つも許可していないので、インターネットからは直接繋げない。
resource "google_sql_database_instance" "main" {
  name             = "${var.project}-db"
  database_version = "POSTGRES_16"
  region           = var.region

  # ハッカソン用。make infra-destroy で消せるようにしてある。
  # 本番運用するなら true に戻す
  deletion_protection = false

  settings {
    tier              = var.db_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL" # 単一ゾーン。冗長化しないぶん安い

    disk_size       = 10
    disk_type       = "PD_HDD" # 最小構成では HDD で十分 (SSD より安い)
    disk_autoresize = true

    # 最小構成なので自動バックアップは切っている。
    # 消えると困るデータが入ったら enabled = true にする
    backup_configuration {
      enabled = false
    }

    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
      # authorized_networks を空にしているので、コネクタ以外からは繋がらない
    }

    # 停止しているあいだ課金を止めたいとき用。既定は常時稼働
    activation_policy = "ALWAYS"
  }

  depends_on = [google_project_service.this]
}

# Rails の production 環境は DB_NAME の末尾に _production を付けて接続する
resource "google_sql_database" "app" {
  name     = "${var.db_name}_production"
  instance = google_sql_database_instance.main.name
}

resource "random_password" "db" {
  length = 32
  # URL やソケット接続でのエスケープ事故を避けるため記号は使わない
  special = false
}

resource "google_sql_user" "app" {
  name     = var.db_username
  instance = google_sql_database_instance.main.name
  password = random_password.db.result
}
