# 本番モードで動かすために必要な鍵。terraform.tfstate に平文で入るので state は共有しない。
# 値を固定したい場合は terraform.tfvars で上書きする。

resource "random_id" "secret_key_base" {
  byte_length = 64
}

resource "random_id" "devise_jwt_secret" {
  byte_length = 64
}

locals {
  secret_key_base   = var.secret_key_base != "" ? var.secret_key_base : random_id.secret_key_base.hex
  devise_jwt_secret = var.devise_jwt_secret_key != "" ? var.devise_jwt_secret_key : random_id.devise_jwt_secret.hex
}
