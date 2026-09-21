locals {
  origin = "http://${aws_lightsail_static_ip.api.ip_address}:${var.app_port}"

  # 共有シークレットを付与する場合だけヘッダを足す
  integration_request_parameters = var.origin_secret == "" ? {} : {
    "append:header.x-origin-secret" = var.origin_secret
  }
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins  = ["*"]
    allow_methods  = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
    allow_headers  = ["*"]
    expose_headers = ["authorization"]
    max_age        = 3600
  }
}

# ルート ("/") 用
resource "aws_apigatewayv2_integration" "root" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "${local.origin}/"
  payload_format_version = "1.0"
  request_parameters     = local.integration_request_parameters
}

resource "aws_apigatewayv2_route" "root" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.root.id}"
}

# それ以外すべて
resource "aws_apigatewayv2_integration" "proxy" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = "${local.origin}/{proxy}"
  payload_format_version = "1.0"
  request_parameters     = local.integration_request_parameters
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.proxy.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}
