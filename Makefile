.PHONY: up down setup logs sh test docs console reset db-apply db-dry-run db-export \
	infra-apply infra-push infra-deploy infra-release infra-up infra-plan infra-destroy \
	infra-url infra-ssh infra-logs infra-console infra-seed infra-secrets

up:            ## コンテナ起動 (初回もこれだけでOK)
	docker compose up --build

down:          ## コンテナ停止
	docker compose down

logs:          ## ログ追尾
	docker compose logs -f api

sh:            ## APIコンテナに入る
	docker compose exec api bash

console:       ## rails console
	docker compose exec api bin/rails console

test:          ## E2E(リクエスト)テスト実行
	docker compose exec api bundle exec rspec

docs:          ## specs から OpenAPI(swagger.yaml) を再生成
	docker compose exec api bundle exec rails rswag

db-apply:      ## db/Schemafile を DB に適用
	docker compose exec api bin/rails db:apply

db-dry-run:    ## db/Schemafile と DB の差分を表示 (適用しない)
	docker compose exec api bin/rails db:dry_run

db-export:     ## 現在の DB の状態を db/Schemafile に書き出す
	docker compose exec api bin/rails db:export

reset:         ## DBを作り直して seed
	docker compose exec api bin/rails db:drop db:create db:apply db:seed

# --- infra (AWS Lightsail + API Gateway) --------------------------------------
TF = ./infra/bin/tf.sh
SSH = ssh -i $$(./infra/bin/tf.sh output -raw ssh_key_path | tr -d '\r') \
	-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
	ubuntu@$$(./infra/bin/tf.sh output -raw instance_ip | tr -d '\r')

infra-apply:   ## Lightsail + API Gateway を作成 (初回もこれ)
	./infra/bin/apply.sh

infra-push:    ## backend のイメージをビルドして ECR に push
	./infra/bin/push.sh

infra-deploy:  ## インスタンスに ECR から pull させて起動
	./infra/bin/deploy.sh

infra-release: ## infra-push + infra-deploy
	./infra/bin/push.sh && ./infra/bin/deploy.sh

infra-up:      ## infra-apply + infra-release (初回はこれ)
	./infra/bin/apply.sh && ./infra/bin/push.sh && ./infra/bin/deploy.sh

infra-secrets: ## terraform の出力を GitHub Secrets に登録 (CI/CDを有効化)
	./infra/bin/github-secrets.sh

infra-plan:    ## AWS側に作られる差分を確認
	$(TF) init -input=false
	$(TF) plan -input=false

infra-destroy: ## Lightsail と API Gateway を削除
	$(TF) destroy -auto-approve -input=false
	rm -f infra/.env

infra-url:     ## 公開URLを表示
	@$(TF) output -raw public_url; echo

infra-ssh:     ## インスタンスに入る
	@$(SSH)

infra-console: ## インスタンス上で rails console (本番モード)
	@$(SSH) -t 'cd /opt/app && docker compose -f compose.yaml -f infra/compose.deploy.yaml --env-file infra/.env exec api bin/rails console'

infra-seed:    ## インスタンス上で db:seed (デモユーザーを入れる)
	@$(SSH) 'cd /opt/app && docker compose -f compose.yaml -f infra/compose.deploy.yaml --env-file infra/.env exec -T api bin/rails db:seed'

infra-logs:    ## インスタンス上の api コンテナのログ
	@$(SSH) 'cd /opt/app && docker compose -f compose.yaml -f infra/compose.deploy.yaml --env-file infra/.env logs -f api'
