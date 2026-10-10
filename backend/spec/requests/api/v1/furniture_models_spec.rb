require "swagger_helper"

RSpec.describe "Api::V1::FurnitureModels", type: :request do
  path "/api/v1/furniture_models" do
    get "利用できる 3D 家具モデルを一覧で取得する" do
      tags "FurnitureModels"
      description "寸法はメートル。GCS の公開ベース URL が未設定の場合、model_url は null。"
      security []
      produces "application/json"

      response "200", "モデル一覧" do
        schema type: :array, items: { "$ref" => "#/components/schemas/FurnitureModel" }
        before { FurnitureImporter.call }

        run_test!
      end
    end
  end

  path "/api/v1/furniture_models/{id}" do
    parameter name: :id, in: :path, type: :string, required: true, description: "モデルの安定 ID (GLB ファイル名から拡張子を除いた値)"

    get "3D 家具モデルのメタデータを取得する" do
      tags "FurnitureModels"
      security []
      produces "application/json"

      response "200", "モデルのメタデータ" do
        schema "$ref" => "#/components/schemas/FurnitureModel"
        before { FurnitureImporter.call }
        let(:id) { Furniture.available.order(:model_key).first.model_key }

        run_test!
      end

      response "404", "モデルが無い、または無効" do
        schema "$ref" => "#/components/schemas/NotFound"
        let(:id) { "missing-model" }

        run_test!
      end
    end
  end
end
