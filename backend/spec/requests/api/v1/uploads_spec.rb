require "swagger_helper"

RSpec.describe "Api::V1::Uploads", type: :request do
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }

  path "/api/v1/uploads" do
    post "部屋写真のアップロード先を発行する" do
      tags "Uploads"
      description <<~DESC
        写真は Rails を通さず、ここで得た upload_url へブラウザから直接 PUT する。
        PUT には Content-Type だけを付ける (署名と食い違うヘッダがあると GCS が 403 を返す)。
        size も署名に含まれるため、実際に送る大きさと一致させる。
        アップロード後、key を POST /api/v1/rooms の photo_keys に渡す。
      DESC
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/UploadInput" }

      response "201", "発行に成功" do
        schema type: :array, items: { "$ref" => "#/components/schemas/Upload" }

        let(:params) { { uploads: [ { content_type: "image/jpeg", size: 284_113 } ] } }

        run_test!
      end

      response "401", "ログインが必要" do
        schema "$ref" => "#/components/schemas/Unauthorized"
        let(:Authorization) { "" }
        let(:params) { { uploads: [ { content_type: "image/jpeg", size: 1024 } ] } }
        run_test!
      end

      response "422", "対応していない形式" do
        schema "$ref" => "#/components/schemas/ValidationErrors"

        let(:params) { { uploads: [ { content_type: "image/gif", size: 1024 } ] } }

        run_test!
      end
    end
  end
end
