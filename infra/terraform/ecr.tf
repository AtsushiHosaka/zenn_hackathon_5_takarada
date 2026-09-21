data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "api" {
  name                 = "${var.project}-api"
  image_tag_mutability = "MUTABLE"

  # make infra-destroy でイメージごと消せるように
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

# 古いイメージを溜めない
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "直近 10 個だけ残す"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

# Lightsail は EC2 と違い IAM ロールを持てないので、
# インスタンスが ECR から pull するための専用ユーザーを作る (pull 権限のみ)。
resource "aws_iam_user" "ecr_puller" {
  name = "${var.project}-ecr-puller"
}

resource "aws_iam_access_key" "ecr_puller" {
  user = aws_iam_user.ecr_puller.name
}

resource "aws_iam_user_policy" "ecr_puller" {
  name = "${var.project}-ecr-pull"
  user = aws_iam_user.ecr_puller.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # GetAuthorizationToken はリソース指定できない
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = aws_ecr_repository.api.arn
      }
    ]
  })
}
