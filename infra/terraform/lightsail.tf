# デプロイ用の SSH 鍵。秘密鍵は infra/.ssh/<project>.pem に書き出される
resource "aws_lightsail_key_pair" "this" {
  name = "${var.project}-key"
}

resource "local_sensitive_file" "private_key" {
  filename        = "${path.module}/../.ssh/${var.project}.pem"
  content         = aws_lightsail_key_pair.this.private_key
  file_permission = "0600"
}

resource "aws_lightsail_instance" "api" {
  name              = "${var.project}-api"
  availability_zone = var.availability_zone
  blueprint_id      = var.blueprint_id
  bundle_id         = var.bundle_id
  key_pair_name     = aws_lightsail_key_pair.this.name

  # Docker と AWS CLI だけ入れておく。
  # アプリは ECR のイメージとして届くので、ここには置かない
  user_data = <<-BASH
    #!/bin/bash
    set -eux
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y ca-certificates curl unzip

    # AWS CLI。Ubuntu 24.04 には awscli の deb が無いので公式インストーラを使う
    case "$(dpkg --print-architecture)" in
      arm64) aws_zip=awscli-exe-linux-aarch64.zip ;;
      *)     aws_zip=awscli-exe-linux-x86_64.zip ;;
    esac
    curl -fsSL "https://awscli.amazonaws.com/$aws_zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
    rm -rf /tmp/aws /tmp/awscliv2.zip

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker ubuntu
    mkdir -p /opt/app
    chown ubuntu:ubuntu /opt/app
    touch /opt/app/.provisioned
  BASH
}

resource "aws_lightsail_static_ip" "api" {
  name = "${var.project}-ip"
}

resource "aws_lightsail_static_ip_attachment" "api" {
  static_ip_name = aws_lightsail_static_ip.api.name
  instance_name  = aws_lightsail_instance.api.name
}

resource "aws_lightsail_instance_public_ports" "api" {
  instance_name = aws_lightsail_instance.api.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = var.ssh_allowed_cidrs
  }

  # API Gateway には固定 IP が無いため、このポートは全公開せざるを得ない。
  # origin_secret を設定すると API Gateway 以外からのリクエストは弾かれる。
  port_info {
    protocol  = "tcp"
    from_port = var.app_port
    to_port   = var.app_port
    cidrs     = ["0.0.0.0/0"]
  }
}
