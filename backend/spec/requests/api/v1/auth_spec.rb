require "swagger_helper"

RSpec.describe "Api::V1::Auth", type: :request do
  path "/api/v1/signup" do
    post "サインアップしてトークンを受け取る" do
      tags "Auth"
      security []
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/SignupInput" }

      response "201", "作成に成功。Authorization ヘッダに Bearer トークンが載る" do
        schema "$ref" => "#/components/schemas/User"
        header "Authorization", schema: { type: :string }, description: "Bearer <JWT>"

        let(:params) do
          { user: { name: "Taro Yamada", email: "taro@example.com", password: "password" } }
        end

        run_test! do |response|
          expect(response.headers["Authorization"]).to start_with("Bearer ")
          expect(JSON.parse(response.body)["email"]).to eq("taro@example.com")
          expect(Identity.find_by(email: "taro@example.com").user.name).to eq("Taro Yamada")
        end
      end

      response "422", "バリデーションエラー" do
        schema "$ref" => "#/components/schemas/ValidationErrors"

        let(:params) { { user: { name: "", email: "invalid", password: "short" } } }

        run_test! do |response|
          expect(JSON.parse(response.body)["errors"]).to be_present
        end
      end
    end
  end

  path "/api/v1/login" do
    post "ログインしてトークンを受け取る" do
      tags "Auth"
      security []
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/LoginInput" }

      response "200", "ログイン成功。Authorization ヘッダに Bearer トークンが載る" do
        schema "$ref" => "#/components/schemas/User"
        header "Authorization", schema: { type: :string }, description: "Bearer <JWT>"

        let(:user) { create(:user, identity: build(:identity, email: "taro@example.com")) }
        let(:params) { { identity: { email: user.email, password: "password" } } }

        run_test! do |response|
          expect(response.headers["Authorization"]).to start_with("Bearer ")
          expect(JSON.parse(response.body)["id"]).to eq(user.id)
        end
      end

      response "401", "メールアドレスかパスワードが違う" do
        schema "$ref" => "#/components/schemas/Unauthorized"

        let(:user) { create(:user) }
        let(:params) { { identity: { email: user.email, password: "wrong-password" } } }

        run_test! do |response|
          expect(response.headers["Authorization"]).to be_nil
        end
      end
    end
  end

  path "/api/v1/logout" do
    delete "ログアウトしてトークンを失効させる" do
      tags "Auth"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "204", "失効に成功。以降このトークンでは 401 になる" do
        let(:user) { create(:user) }
        let(:Authorization) { bearer_token_for(user) }

        before { @jti_before = user.identity.jti }

        run_test! do
          # devise-jwt は jti を打ち直すことでトークンを無効化する
          expect(user.identity.reload.jti).not_to eq(@jti_before)

          get "/api/v1/me", headers: { "Authorization" => send(:Authorization) }
          expect(response).to have_http_status(:unauthorized)
        end
      end

      response "401", "トークンが無い" do
        schema "$ref" => "#/components/schemas/Unauthorized"

        let(:Authorization) { "" }

        run_test!
      end
    end
  end

  path "/api/v1/me" do
    get "トークンの持ち主を返す" do
      tags "Auth"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "取得に成功" do
        schema "$ref" => "#/components/schemas/User"

        let(:user) { create(:user, name: "Hanako") }
        let(:Authorization) { bearer_token_for(user) }

        run_test! do |response|
          expect(JSON.parse(response.body)["name"]).to eq("Hanako")
        end
      end

      response "401", "トークンが不正" do
        schema "$ref" => "#/components/schemas/Unauthorized"

        let(:Authorization) { "Bearer not-a-real-token" }

        run_test!
      end
    end
  end
end
