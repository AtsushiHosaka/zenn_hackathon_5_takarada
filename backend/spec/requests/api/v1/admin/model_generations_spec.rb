require "swagger_helper"

RSpec.describe "Api::V1::Admin::ModelGenerations", type: :request do
  let(:current) { create(:user, admin: true) }
  let(:Authorization) { bearer_token_for(current) }
  let(:detail) { FurnitureDetail.find_by!(category: "chair") }
  let(:glb) { "glTF-test-bytes" }
  let(:models_bucket) { ENV["MODELS_BUCKET"].presence || "local-models" }
  let(:result) do
    { "status" => "succeeded", "error" => nil, "notes" => "箱で表現",
      "checks" => [ { "name" => "connected", "ok" => true, "detail" => "すべての部品がつながっています" } ],
      "stats" => { "triangles" => 860, "materials" => %w[tint metal], "bytes" => glb.bytesize, "sha256" => Digest::SHA256.hexdigest(glb), "size" => { "w" => 0.4, "h" => 0.8, "d" => 0.4 } },
      "ai" => { "model" => "gemini-3.1-pro-preview", "calls" => 1, "seconds" => 95, "input_tokens" => 1, "output_tokens" => 1 } }
  end

  # ジョブが置き場に結果を書いた状態にする
  def finish(generation)
    Storage.client.store(ModelGeneration.asset(generation, "result.json"), result.to_json)
    Storage.client.store(ModelGeneration.asset(generation, "model.glb"), glb)
    Storage.client.store(ModelGeneration.asset(generation, "front.png"), "png")
  end

  before do
    CharacterImporter.call
    FurnitureImporter.call
    FurnitureDetailImporter.call
    # テストでは生成のジョブを動かさない
    allow(ModelGeneration::Runner).to receive_messages(available?: true, start: nil)
  end

  after { FileUtils.rm_rf(Rails.root.join("tmp/storage/local-model-builds")) }

  path "/api/v1/admin/furniture_details/{furniture_detail_id}/model_generations" do
    parameter name: :furniture_detail_id, in: :path, type: :integer, required: true
    let(:furniture_detail_id) { detail.id }

    post "商品の 3D モデルを AI に作らせる" do
      tags "Admin"
      description "管理者だけが使える。生成は数分かかる。状態は取得し直して確かめる。"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "201", "生成を始めた" do
        schema "$ref" => "#/components/schemas/AdminModelGeneration"

        run_test! do |response|
          generation = FurnitureModelGeneration.find(response.parsed_body["id"])
          expect(generation.status).to eq("running")
          expect(JSON.parse(Storage.client.download(ModelGeneration.asset(generation, "request.json")))).to include("model_key" => generation.model_key, "name" => detail.name)
        end
      end

      response "422", "同じ商品を生成中" do
        schema "$ref" => "#/components/schemas/ValidationErrors"
        before { FurnitureModelGeneration.create!(furniture_detail: detail, user: current, model_key: "ai_running") }

        run_test!
      end
    end

    get "商品の生成を新しい順に取得する" do
      tags "Admin"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "生成の一覧 (生成中のものは結果を取り込んでから返す)" do
        schema type: :array, items: { "$ref" => "#/components/schemas/AdminModelGeneration" }
        before { finish(FurnitureModelGeneration.create!(furniture_detail: detail, user: current, model_key: "ai_done")) }

        run_test! do |response|
          expect(response.parsed_body.first).to include("status" => "succeeded", "files" => %w[front.png side.png model.glb])
        end
      end
    end
  end

  path "/api/v1/admin/model_generations/{id}/adopt" do
    parameter name: :id, in: :path, type: :integer, required: true
    let(:generation) { FurnitureModelGeneration.create!(furniture_detail: detail, user: current, model_key: "ai_adopt") }
    let(:id) { generation.id }

    post "生成したモデルを、商品の 3D モデルとして採用する" do
      tags "Admin"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "採用した" do
        schema "$ref" => "#/components/schemas/AdminModelGeneration"
        before do
          finish(generation)
          ModelGeneration.sync(generation)
        end
        after { FileUtils.rm_rf(Rails.root.join("tmp/storage", models_bucket, "models/furniture/v1/ai_adopt.glb")) }

        run_test! do
          model = Furniture3DModel.find_by!(model_key: "ai_adopt")
          expect(detail.reload.furniture).to eq(model.furniture)
          expect(detail.color_materials).to eq("tint" => detail.symbolic_color)
          expect(Storage.client.download(Storage.asset(models_bucket, model.object_key))).to eq(glb)
        end
      end

      response "422", "採用待ちではない" do
        schema "$ref" => "#/components/schemas/ValidationErrors"

        run_test!
      end
    end
  end

  path "/api/v1/admin/model_generations/{id}/reject" do
    parameter name: :id, in: :path, type: :integer, required: true
    let(:id) { FurnitureModelGeneration.create!(furniture_detail: detail, user: current, model_key: "ai_reject", status: "succeeded").id }

    post "生成したモデルを不採用にする" do
      tags "Admin"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "不採用にした" do
        schema "$ref" => "#/components/schemas/AdminModelGeneration"

        run_test!
      end
    end
  end

  path "/api/v1/admin/model_generations/{id}" do
    parameter name: :id, in: :path, type: :integer, required: true
    let(:id) { FurnitureModelGeneration.create!(furniture_detail: detail, user: current, model_key: "ai_show").id }

    get "生成を 1 件取得する (生成中なら結果を取り込んでから返す)" do
      tags "Admin"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "生成" do
        schema "$ref" => "#/components/schemas/AdminModelGeneration"

        run_test!
      end
    end
  end

  path "/api/v1/admin/model_generations/{id}/files/{name}" do
    parameter name: :id, in: :path, type: :integer, required: true
    parameter name: :name, in: :path, type: :string, required: true, description: "front.png / side.png / model.glb"
    let(:generation) { FurnitureModelGeneration.create!(furniture_detail: detail, user: current, model_key: "ai_file") }
    let(:id) { generation.id }
    let(:name) { "front.png" }

    get "確認用の画像・GLB を取得する" do
      tags "Admin"
      security [ { bearerAuth: [] } ]
      produces "image/png", "model/gltf-binary"

      response "200", "ファイルの中身" do
        before { finish(generation) }

        run_test! do |response|
          expect(response.body).to eq("png")
        end
      end
    end
  end
end
