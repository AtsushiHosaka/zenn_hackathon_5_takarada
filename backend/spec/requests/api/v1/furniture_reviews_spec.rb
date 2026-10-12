require "swagger_helper"

RSpec.describe "Api::V1::FurnitureReviews", type: :request do
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }
  let(:sofa) { { name: "2人掛けソファ", category: "sofa", color: "#8a8f98", size: { w: 1.5, h: 0.8, d: 0.8 }, existing: false } }
  let(:room) { { width: 2.7, depth: 3.6, wall_color: "#f4f1ea", floor_color: "#d9bf99" } }

  path "/api/v1/furniture_reviews" do
    post "部屋に置いた家具が似合っているかをAIに聞く" do
      tags "FurnitureReviews"
      description "対象の家具1つについて、色・大きさ・雰囲気が部屋に合うかを答える。画面が今の配置を送り、結果は保存しない。Geminiが使えるときは登録された商品の写真も見せる。使えないときは色と大きさだけから答え、reviewed_byがmockになる。AIが答えられないときは503。"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/FurnitureReviewInput" }

      response "200", "答え" do
        schema "$ref" => "#/components/schemas/FurnitureReview"
        let(:params) { { target: sofa, room:, others: [ { name: "ベッド", category: "bed", color: "#ffffff", size: { w: 1.0, h: 0.4, d: 2.0 }, existing: true } ], prompt: "落ち着いた部屋にしたい" } }
        run_test! do |response|
          review = JSON.parse(response.body)
          expect(review["reviewed_by"]).to eq("mock")
          expect(review["verdict"]).to eq("good")
          expect(review["size"]).to include("12%")
        end
      end

      response "401", "ログインが必要" do
        schema "$ref" => "#/components/schemas/Unauthorized"
        let(:Authorization) { "" }
        let(:params) { { target: sofa, room: } }
        run_test!
      end

      response "422", "入力の確認に失敗" do
        schema "$ref" => "#/components/schemas/ValidationErrors"
        let(:params) { { target: sofa.merge(color: "gray"), room: } }
        run_test!
      end
    end
  end
end
