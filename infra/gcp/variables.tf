variable "project_id" {
  description = "GCP プロジェクト ID。make infra-bootstrap が表示する値を terraform.tfvars に入れる"
  type        = string
}

variable "project" {
  description = "リソース名の接頭辞"
  type        = string
  default     = "zenn-hackathon"
}

variable "region" {
  description = "Cloud Run / Cloud SQL / Artifact Registry を置くリージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "db_tier" {
  description = <<-DESC
    Cloud SQL のマシンタイプ。db-f1-micro が最小 (共有コア / 月 ¥1,500 前後)。
    重くなったら db-g1-small (1.7GB) に上げる。
  DESC
  type        = string
  default     = "db-f1-micro"
}

variable "db_name" {
  description = <<-DESC
    Rails の DB_NAME。production では Rails が末尾に _production を付けるので、
    実際に作られるデータベース名は "<db_name>_production" になる。
  DESC
  type        = string
  default     = "app"
}

variable "db_username" {
  description = "アプリが使う Cloud SQL のユーザー名"
  type        = string
  default     = "app"
}

variable "api_image" {
  description = <<-DESC
    Cloud Run (API) が動かすイメージ。初回 apply の時点ではまだ自前のイメージが
    無いので、Google 提供のサンプルを置いておく。実際のイメージは
    make infra-release (gcloud run deploy) が差し替え、terraform は
    lifecycle.ignore_changes で以後そこに触らない。
  DESC
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "web_image" {
  description = "Cloud Run (Web フロント) が動かすイメージ。既定値の扱いは api_image と同じ"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "cors_origins" {
  description = <<-DESC
    API が許可するオリジン (カンマ区切り)。空なら Web フロントの Cloud Run URL だけを許可する。
    ローカルの Vite からも実 API を叩くなら "http://localhost:5173" を足す。
  DESC
  type        = string
  default     = ""
}

variable "gemini_api_key_secret_id" {
  description = "同じGCPプロジェクト内に既にあるGemini APIキーのSecret Manager ID。空ならAI設定と権限を追加しない。秘密値は渡さない。"
  type        = string
  default     = ""

  validation {
    condition     = var.gemini_api_key_secret_id == "" || can(regex("^[A-Za-z0-9_-]+$", var.gemini_api_key_secret_id))
    error_message = "secret_idは同じプロジェクト内の短いIDを指定してください。キーの値やリソースパスは入力しないでください。"
  }
}

variable "gemini_api_key_secret_version" {
  description = "使用する既存Secretの固定version番号。latestは使わず、ローテーション時に明示更新する。"
  type        = string
  default     = "1"

  validation {
    condition     = can(regex("^[1-9][0-9]*$", var.gemini_api_key_secret_version))
    error_message = "Secret versionは1以上の固定番号を指定してください。"
  }
}

variable "gemini_grant_secret_access" {
  description = "指定Secretに既存APIサービスアカウントの読取を今回新規付与するときだけtrue。既存grantは管理・削除しない。"
  type        = bool
  default     = false
}

variable "gemini_allowed_user_ids" {
  description = "実AIを許可する部屋owner ID。限定検証の使い捨てユーザーだけ指定する。空は全員mock。"
  type        = list(number)
  default     = []

  validation {
    condition     = alltrue([for id in var.gemini_allowed_user_ids : id >= 1 && id == floor(id)])
    error_message = "許可するuser IDは1以上の整数です。"
  }
}

variable "gemini_allow_all_users" {
  description = "一般利用のAIと継続費用を本人が明示承認した場合だけtrue。限定検証の予算とは別。"
  type        = bool
  default     = false
}

variable "gemini_model" {
  description = "Gemini secret参照を有効にしたAPIで使用するモデル。料金とInteractions API対応を確認してから変更する。"
  type        = string
  default     = "gemini-3.1-flash-lite"

  validation {
    condition     = trimspace(var.gemini_model) != ""
    error_message = "Gemini modelは空にできません。"
  }
}

variable "gemini_thinking_level" {
  description = "Gemini secret参照を有効にしたAPIのthinking level。空ならモデル既定値。"
  type        = string
  default     = ""

  validation {
    condition     = contains(["", "minimal", "low", "medium", "high"], var.gemini_thinking_level)
    error_message = "thinking levelは空、minimal、low、medium、highのいずれかです。"
  }
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
  description = <<-DESC
    owner/repo 形式。指定すると GitHub Actions 用の Workload Identity
    (鍵を GitHub に置かずに認証する仕組み) とサービスアカウントを作る。
  DESC
  type        = string
  default     = ""
}

variable "api_max_instances" {
  description = "Cloud Run (API) の最大インスタンス数。暴走時の課金の上限になる"
  type        = number
  default     = 3
}

variable "web_max_instances" {
  description = "Cloud Run (Web フロント) の最大インスタンス数"
  type        = number
  default     = 2
}
