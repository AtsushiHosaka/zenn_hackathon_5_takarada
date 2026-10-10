require "swagger_helper"

# このファイル1つで
#   * E2E(リクエスト)テスト       -> bundle exec rspec
#   * OpenAPI 仕様書 swagger.yaml -> bundle exec rails rswag
# の両方を賄う。
#
# 作成は POST /api/v1/signup (auth_spec.rb) が担当するのでここには無い。
RSpec.describe "Api::V1::Users", type: :request do
  # 全エンドポイントがトークン必須。`let(:Authorization)` でヘッダを渡す
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }

  path "/api/v1/users" do
    get "本人のプロフィールを一覧形式で取得する" do
      tags "Users"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "一覧が返る" do
        schema type: :array, items: { "$ref" => "#/components/schemas/User" }

        before { create_list(:user, 2) }

        run_test! do |response|
          body = JSON.parse(response.body)
          expect(body.map { |user| user["id"] }).to eq([ current.id ])
          expect(body.first.keys).to contain_exactly("id", "name", "email", "admin", "created_at", "updated_at")
        end
      end

      response "401", "トークンが無い" do
        schema "$ref" => "#/components/schemas/Unauthorized"

        let(:Authorization) { "" }

        run_test!
      end
    end
  end

  path "/api/v1/users/{id}" do
    parameter name: :id, in: :path, type: :integer, description: "User ID", required: true

    get "本人のプロフィールを取得する" do
      tags "Users"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "取得に成功" do
        schema "$ref" => "#/components/schemas/User"

        let(:user) { current }
        let(:id) { user.id }

        run_test! do |response|
          expect(JSON.parse(response.body)["name"]).to eq(current.name)
        end
      end

      response "404", "ユーザーが存在しない、または他のユーザー" do
        schema "$ref" => "#/components/schemas/NotFound"

        let(:id) { create(:user).id }

        run_test!
      end
    end

    patch "ユーザーを更新する" do
      tags "Users"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/UserInput" }

      response "200", "更新に成功" do
        schema "$ref" => "#/components/schemas/User"

        let(:user) { current }
        let(:id) { user.id }
        let(:params) { { user: { name: "Updated Name" } } }

        run_test! do |response|
          expect(JSON.parse(response.body)["name"]).to eq("Updated Name")
          expect(user.reload.name).to eq("Updated Name")
        end
      end

      response "404", "本人のプロフィールではない" do
        schema "$ref" => "#/components/schemas/NotFound"
        let(:id) { create(:user).id }
        let(:params) { { user: { name: "Updated Name" } } }
        run_test!
      end

      response "422", "バリデーションエラー" do
        schema "$ref" => "#/components/schemas/ValidationErrors"

        let(:user) { current }
        let(:id) { user.id }
        let(:params) { { user: { name: "" } } }

        run_test!
      end
    end

    delete "ユーザーを削除する" do
      tags "Users"
      security [ { bearerAuth: [] } ]

      response "204", "削除に成功" do
        let(:user) { current }
        let(:id) { user.id }

        run_test! do
          expect(User.exists?(id)).to be false
        end
      end

      response "404", "ユーザーが存在しない、または他のユーザー" do
        schema "$ref" => "#/components/schemas/NotFound"

        let(:id) { create(:user).id }

        run_test!
      end
    end
  end
end
