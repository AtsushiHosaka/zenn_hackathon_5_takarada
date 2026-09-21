variable "project" {
  description = "リソース名の接頭辞"
  type        = string
  default     = "hack"
}

variable "region" {
  description = "AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "availability_zone" {
  description = "Lightsail インスタンスを置く AZ。region の中の AZ を指定する"
  type        = string
  default     = "ap-northeast-1a"
}

variable "bundle_id" {
  description = <<-DESC
    Lightsail のプラン。Rails + PostgreSQL + ビルドを同居させるので 2GB 以上を推奨。
    micro_3_0 = 1GB / small_3_0 = 2GB / medium_3_0 = 4GB
  DESC
  type        = string
  default     = "small_3_0"
}

variable "blueprint_id" {
  description = "OS イメージ"
  type        = string
  default     = "ubuntu_24_04"
}

variable "app_port" {
  description = "インスタンス上で API が待ち受けるポート"
  type        = number
  default     = 3000
}

variable "ssh_allowed_cidrs" {
  description = "SSH(22) を許可する CIDR。自宅/オフィスの IP に絞ることを推奨"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "origin_secret" {
  description = <<-DESC
    API Gateway が付与する共有シークレット。空なら無効。
    値を入れると API Gateway 経由のリクエストだけが通るようになる
    (インスタンス側は ORIGIN_SECRET 環境変数で同じ値を受け取って検証する)。
  DESC
  type        = string
  default     = ""
  sensitive   = true
}

variable "secret_key_base" {
  description = "Rails の SECRET_KEY_BASE。空なら terraform が生成する"
  type        = string
  default     = ""
  sensitive   = true
}

variable "devise_jwt_secret_key" {
  description = "JWT の署名鍵。空なら terraform が生成する"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_repository" {
  description = "owner/repo 形式。指定すると GitHub Actions 用の IAM ロール (OIDC) を作る"
  type        = string
  default     = ""
}

variable "create_github_oidc_provider" {
  description = "AWS アカウントに GitHub の OIDC プロバイダが未作成なら true。既にあるなら false"
  type        = bool
  default     = true
}
