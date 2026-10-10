require "swagger_helper"

RSpec.describe "Api::V1::Admin::FurnitureModels", type: :request do
  let(:current) { create(:user, admin: true) }
  let(:Authorization) { bearer_token_for(current) }

  before do
    CharacterImporter.call
    FurnitureImporter.call
  end

  path "/api/v1/admin/furniture_models" do
    get "3D モデルを無効なものも含めて一覧で取得する" do
      tags "Admin"
      description "管理者 (users.admin) だけが使える。"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "モデル一覧" do
        schema type: :array, items: { "$ref" => "#/components/schemas/AdminFurnitureModel" }

        run_test!
      end
    end
  end

  path "/api/v1/admin/furniture_models/{id}" do
    parameter name: :id, in: :path, type: :string, required: true, description: "モデルの安定 ID"

    patch "3D モデルの有効・無効を切り替える" do
      tags "Admin"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/AdminFurnitureModelInput" }
      let(:id) { Furniture3DModel.order(:model_key).first.model_key }

      response "200", "切り替えに成功" do
        schema "$ref" => "#/components/schemas/AdminFurnitureModel"
        let(:params) { { furniture_model: { enabled: false } } }

        run_test! do
          expect(Furniture3DModel.find_by!(model_key: id).furniture).not_to be_enabled
        end
      end
    end
  end
end
