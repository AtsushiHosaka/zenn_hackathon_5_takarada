.PHONY: up down setup logs worker-logs sh test docs console reset db-apply db-dry-run db-export \
	front-sh front-logs front-lint front-build front-types furniture-import infra-models-publish \
	ios-setup ios-open ios-build \
	infra-bootstrap infra-apply infra-plan infra-release infra-up infra-destroy \
	infra-url infra-logs infra-db-apply infra-seed infra-task infra-psql infra-secrets

up:            ## コンテナ起動 (初回もこれだけでOK)
	docker compose up --build

down:          ## コンテナ停止
	docker compose down

logs:          ## ログ追尾
	docker compose logs -f api

worker-logs:   ## sidekiq (worker) のログ追尾
	docker compose logs -f worker

sh:            ## APIコンテナに入る
	docker compose exec api bash

console:       ## rails console
	docker compose exec api bin/rails console

test:          ## 既存のAPIリクエストテスト実行
	docker compose exec api bundle exec rspec

docs:          ## specs から OpenAPI(swagger.yaml) を再生成
	docker compose exec api bundle exec rails rswag

db-apply:      ## db/Schemafile を DB に適用
	docker compose exec api bin/rails furniture_texture:clear_legacy db:apply

db-dry-run:    ## db/Schemafile と DB の差分を表示 (適用しない)
	docker compose exec api bin/rails db:dry_run

db-export:     ## 現在の DB の状態を db/Schemafile に書き出す
	docker compose exec api bin/rails db:export

reset:         ## DBを作り直して seed
	docker compose exec api bin/rails db:drop db:create db:apply db:seed

# --- frontend (React + Vite) --------------------------------------------------
# `make up` で web も一緒に立つ (http://localhost:5173)。以下はそのコンテナで叩く。
# ホストに node があるなら frontend/ で npm run dev などを直接使ってもよい。

front-logs:    ## Vite のログ追尾
	docker compose logs -f web

front-sh:      ## web コンテナに入る
	docker compose exec web sh

front-lint:    ## eslint + 型チェック
	docker compose exec web npm run lint
	docker compose exec web npm run typecheck

front-build:   ## 本番ビルド (frontend/dist に出る)
	docker compose exec web npm run build

front-types:   ## backend の OpenAPI から TypeScript の型を再生成
	docker compose exec web npm run types

# --- ios (SwiftUI) ------------------------------------------------------------
IOS_PROJECT = ios/ios.xcodeproj

ios-setup:     ## ios/Info.plist を用意する (clone したら最初にこれ)
	@test -f ios/Info.plist \
		&& echo "ios/Info.plist は既にある (API_ENDPOINT を変えるなら直接編集)" \
		|| (cp ios/Info.plist.example ios/Info.plist && echo "ios/Info.plist を作成した")

ios-open:      ## Xcode で開く
	open $(IOS_PROJECT)

ios-build:     ## シミュレータ向けにビルドだけ通す (Xcode を開かず確認)
	xcodebuild -project $(IOS_PROJECT) -scheme ios \
		-destination 'platform=iOS Simulator,name=iPhone 17' build

# --- infra (GCP: Cloud Run + Cloud SQL) ---------------------------------------
# 定義は infra/gcp/*.tf、操作は infra/gcp/bin/*.sh。
# 初回は make infra-bootstrap -> make infra-up の順に実行する。
GBIN = ./infra/gcp/bin
GTF  = terraform -chdir=infra/gcp

infra-bootstrap: ## 初回だけ: gcloud ログイン + プロジェクト選択 + API 有効化 (対話)
	$(GBIN)/bootstrap.sh

infra-apply:   ## GCP 側にリソースを作る / 差分を反映する
	$(GBIN)/apply.sh

infra-plan:    ## GCP 側に作られる差分を確認する
	$(GTF) init -input=false
	$(GTF) plan -input=false

infra-release: ## イメージをビルドして push -> スキーマ適用 -> Cloud Run を更新
	$(GBIN)/release.sh

infra-up:      ## infra-apply + infra-release (2 回目以降の初期構築はこれ)
	$(GBIN)/apply.sh && $(GBIN)/release.sh

infra-secrets: ## terraform の出力を GitHub Secrets に登録 (CI/CD を有効化)
	$(GBIN)/github-secrets.sh

infra-destroy: ## GCP 側のリソースを全部削除 (Cloud SQL のデータも消える)
	$(GBIN)/destroy.sh

infra-url:     ## 公開 URL を表示
	@echo "API  $$($(GTF) output -raw api_url)"
	@echo "Web  $$($(GTF) output -raw web_url)"

infra-logs:    ## Cloud Run (API) の直近のログ (追尾は gcloud beta run services logs tail)
	@gcloud run services logs read $$($(GTF) output -raw api_service) --limit 100 \
		--region $$($(GTF) output -raw region) --project $$($(GTF) output -raw project_id)

infra-db-apply: ## db/Schemafile を Cloud SQL に適用
	$(GBIN)/db-apply.sh

infra-seed:    ## Cloud SQL に db:seed (デモユーザーを入れる)
	$(GBIN)/task.sh db:seed

infra-task:    ## 任意の rails タスクを Cloud Run ジョブで流す (例: make infra-task T=db:dry_run)
	$(GBIN)/task.sh $(T)

infra-psql:    ## Cloud SQL に psql で繋ぐ (自分の IP を一時的に許可する)
	@gcloud sql connect $$($(GTF) output -raw db_instance) \
		--user=$$($(GTF) output -raw db_username) \
		--database=$$($(GTF) output -raw db_database) \
		--project $$($(GTF) output -raw project_id)

furniture-import: ## 家具・模様・色と購入リンク (db/furnitures.json, furniture_textures.json, furniture_details.json) をDBへ取り込む
	docker compose exec api bin/rails furniture:import furniture_texture:import furniture_detail:import

infra-models-publish: ## 生成済み家具GLBをMODELS_BUCKETまたはTerraformのバケットへ配置
	$(GBIN)/models-publish.sh
