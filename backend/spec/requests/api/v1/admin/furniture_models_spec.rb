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

    put "3D モデルを登録・更新する" do
      tags "Admin"
      description "GLB は先に公開バケットへ置く。無ければ作り、あれば上書きする。有効・無効は変えない。"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/AdminFurnitureModelUpsert" }
      let(:id) { "cushion" }
      let(:params) do
        { furniture_model: { name: "クッション", category: "cushion", shape: "cushion", variant: nil, size: [ 0.45, 0.15, 0.45 ],
                             triangles: 2496, bytes: 62864, sha256: "a" * 64, color_material_keys: [ "tint" ], characters: [] } }
      end

      response "200", "登録・更新に成功" do
        schema "$ref" => "#/components/schemas/AdminFurnitureModel"

        run_test! do
          expect(Furniture3DModel.find_by!(model_key: id)).to have_attributes(triangle_count: 2496, sha256: "a" * 64)
        end
      end

      response "422", "内容が不正" do
        let(:params) { { furniture_model: { name: "クッション", category: "cushion", shape: "cushion", size: [ 0.45, 0.15 ] } } }

        run_test!
      end
    end

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

  path "/api/v1/admin/furniture_models/export" do
    get "3D モデルを db/furnitures.json の形で書き出す" do
      tags "Admin"
      description "控えを取るときと、初期データ (db/furnitures.json) を今の DB に合わせるときに使う。"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "db/furnitures.json と同じ形" do
        schema "$ref" => "#/components/schemas/AdminFurnitureModelExport"

        run_test! do |response|
          # 書き出した JSON は初期データと同じになる
          expect(JSON.parse(response.body)).to eq(JSON.parse(Rails.root.join("db/furnitures.json").read))
        end
      end
    end
  end
end
