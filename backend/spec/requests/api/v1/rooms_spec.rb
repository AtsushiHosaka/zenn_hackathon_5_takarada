require "swagger_helper"

RSpec.describe "Api::V1::Rooms", type: :request do
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }

  path "/api/v1/rooms" do
    post "部屋を登録して解析を始める" do
      tags "Rooms"
      description "解析は非同期。GET /api/v1/rooms/{id} で status が ready になるまでポーリングする。写真と Gemini の設定がある場合は AI で解析し、無い場合は畳数と形からモックを作る。登録・取得は本人の部屋のみ"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/RoomInput" }

      response "201", "登録に成功 (status: analyzing)" do
        schema "$ref" => "#/components/schemas/Room"

        let(:params) { { room: { tatami: 6, shape: "standard" } } }

        run_test! do
          expect(AnalyzeRoomJob).to have_been_enqueued
        end
      end

      response "401", "ログインが必要" do
        schema "$ref" => "#/components/schemas/Unauthorized"
        let(:Authorization) { "" }
        let(:params) { { room: { tatami: 6, shape: "standard" } } }
        run_test!
      end

      response "422", "畳数が範囲外" do
        schema "$ref" => "#/components/schemas/ValidationErrors"

        let(:params) { { room: { tatami: 100, shape: "standard" } } }

        run_test!
      end
    end
  end

  path "/api/v1/rooms/{id}" do
    parameter name: :id, in: :path, type: :integer, required: true

    get "部屋と解析結果 (シーン) を取得する" do
      tags "Rooms"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "解析済みの部屋" do
        schema "$ref" => "#/components/schemas/Room"

        let(:room) { current.rooms.create!(tatami: 6, shape: "standard").tap { |r| r.update!(scene: RoomAnalyzer.call(r).scene, analyzed_by: "mock", status: "ready") } }
        let(:id) { room.id }

        run_test!
      end

      response "404", "部屋が無い、または本人の部屋ではない" do
        schema "$ref" => "#/components/schemas/NotFound"

        let(:id) { create(:user).rooms.create!(tatami: 6, shape: "standard").id }

        run_test!
      end
    end
  end
end
