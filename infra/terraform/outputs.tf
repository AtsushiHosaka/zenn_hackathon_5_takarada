output "public_url" {
  description = "API Gateway 経由の HTTPS エンドポイント"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "instance_ip" {
  description = "Lightsail の固定 IP"
  value       = aws_lightsail_static_ip.api.ip_address
}

output "origin_url" {
  description = "API Gateway を通さない直接アクセス先 (デバッグ用)"
  value       = local.origin
}

output "ssh_key_path" {
  description = "書き出された秘密鍵のパス"
  value       = "infra/.ssh/${var.project}.pem"
}

output "origin_secret" {
  description = "API Gateway が付与する共有シークレット (空なら無効)"
  value       = var.origin_secret
  sensitive   = true
}

output "secret_key_base" {
  description = "Rails の SECRET_KEY_BASE"
  value       = local.secret_key_base
  sensitive   = true
}

output "devise_jwt_secret_key" {
  description = "JWT の署名鍵"
  value       = local.devise_jwt_secret
  sensitive   = true
}

output "ecr_repository_url" {
  description = "イメージの push/pull 先"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_registry" {
  description = "docker login の対象レジストリ"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.region}.amazonaws.com"
}

output "ecr_puller_access_key_id" {
  description = "インスタンスが ECR から pull するための鍵"
  value       = aws_iam_access_key.ecr_puller.id
  sensitive   = true
}

output "ecr_puller_secret_access_key" {
  value     = aws_iam_access_key.ecr_puller.secret
  sensitive = true
}

output "github_actions_role_arn" {
  description = "GitHub Actions に設定する IAM ロール ARN (github_repository 未指定なら空)"
  value       = local.gh_enabled ? aws_iam_role.github_actions[0].arn : ""
}

output "region" {
  description = "AWS リージョン"
  value       = var.region
}
