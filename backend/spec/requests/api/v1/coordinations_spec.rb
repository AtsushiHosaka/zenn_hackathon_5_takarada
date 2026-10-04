require "swagger_helper"

RSpec.describe "Api::V1::Coordinations", type: :request do
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }

  let(:room) { current.rooms.create!(tatami: 6, shape: "standard").tap { |r| r.update!(scene: RoomAnalyzer.call(r).scene, analyzed_by: "mock", status: "ready") } }

  path "/api/v1/rooms/{room_id}/coordinations" do
    parameter name: :room_id, in: :path, type: :integer, required: true

    post "コーデ提案の生成を始める" do
      tags "Coordinations"
      description "生成は非同期。GET /api/v1/coordinations/{id} で status が done / failed になるまでポーリングする。現在の商品選定は AI 未接続のモック (キーワードでテーマを判定) で、商品候補はインテリアリンク取得のモック (InteriorLinks::MockClient)"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/CoordinationInput" }

      response "201", "受付に成功 (status: pending)" do
        schema "$ref" => "#/components/schemas/Coordination"

        let(:room_id) { room.id }
        let(:params) { { coordination: { prompt: "紫色の推し活ルームにしたい", budget: 30_000, kept_object_ids: %w[bed-1 desk-1], edited_objects: [ room.scene["objects"].first.slice("id", "position", "size", "rotation_y", "color") ] } } }

        run_test! do
          expect(GenerateCoordinationJob).to have_been_enqueued
        end
      end

      response "401", "ログインが必要" do
        schema "$ref" => "#/components/schemas/Unauthorized"
        let(:Authorization) { "" }
        let(:room_id) { room.id }
        let(:params) { { coordination: { prompt: "紫色の部屋", budget: 30_000 } } }
        run_test!
      end

      response "404", "本人の部屋ではない" do
        schema "$ref" => "#/components/schemas/NotFound"
        let(:room_id) { create(:user).rooms.create!(tatami: 6, shape: "standard").id }
        let(:params) { { coordination: { prompt: "紫色の部屋", budget: 30_000 } } }
        run_test!
      end

      response "422", "部屋の解析が終わっていない、または入力が不正" do
        schema "$ref" => "#/components/schemas/ValidationErrors"

        let(:room_id) { current.rooms.create!(tatami: 6, shape: "standard").id }
        let(:params) { { coordination: { prompt: "紫色の推し活ルームにしたい", budget: 30_000 } } }

        run_test!
      end
    end
  end

  path "/api/v1/coordinations/{id}" do
    parameter name: :id, in: :path, type: :integer, required: true

    get "コーデ提案 (配置後のシーンと購入リンク) を取得する" do
      tags "Coordinations"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "生成済みのコーデ" do
        schema "$ref" => "#/components/schemas/Coordination"

        let(:coordination) do
          room.coordinations.create!(prompt: "紫色の推し活ルームにしたい", budget: 30_000).tap do |c|
            c.update!(status: "done", **CoordinationBuilder.call(c).to_h)
          end
        end
        let(:id) { coordination.id }

        run_test! do |response|
          body = JSON.parse(response.body)
          suggested = body["after_scene"]["objects"].select { |o| o["source"] == "suggested" }
          expect(suggested.map { |o| o["marker"] }).to eq(body["items"].map { |i| i["marker"] })
          expect(body["total_price"]).to be <= 30_000
        end
      end

      response "404", "本人のコーデではない" do
        schema "$ref" => "#/components/schemas/NotFound"
        let(:id) { create(:user).rooms.create!(tatami: 6, shape: "standard").coordinations.create!(prompt: "紫色の部屋", budget: 30_000).id }
        run_test!
      end
    end
  end
end
