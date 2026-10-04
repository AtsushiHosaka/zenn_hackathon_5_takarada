require "swagger_helper"

RSpec.describe "Api::V1::Rooms", type: :request do
  path "/api/v1/rooms" do
    post "部屋を登録して解析を始める" do
      tags "Rooms"
      description "解析は非同期。GET /api/v1/rooms/{id} で status が ready になるまでポーリングする。現在の解析は AI 未接続のモック (畳数と部屋の形から部屋を作る)"
      security []
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
      security []
      produces "application/json"

      response "200", "解析済みの部屋" do
        schema "$ref" => "#/components/schemas/Room"

        let(:room) { Room.create!(tatami: 6, shape: "standard").tap { |r| r.update!(scene: RoomAnalyzer.call(r).scene, analyzed_by: "mock", status: "ready") } }
        let(:id) { room.id }

        run_test!
      end

      response "404", "部屋が無い" do
        schema "$ref" => "#/components/schemas/NotFound"

        let(:id) { 0 }

        run_test!
      end
    end
  end
end
