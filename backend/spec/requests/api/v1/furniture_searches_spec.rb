require "swagger_helper"

RSpec.describe "Api::V1::FurnitureSearches", type: :request do
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }

  path "/api/v1/furniture_searches" do
    post "家具を検索し公式の色で絞り込む" do
      tags "FurnitureSearches"
      description "公式商品ページを検証し、掲載されている色名で絞り込む。最大24件。色違いは公式の選択欄・ProductGroupにあるURLとSKUを返し、選択時にfurniture_importsで商品情報を再確認する。検索は最大130秒。"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/FurnitureSearchInput" }

      response "200", "検索結果" do
        schema "$ref" => "#/components/schemas/FurnitureSearchResult"
        let(:params) { { query: "テーブル", color: "blue" } }
        before do
          allow(FurnitureSearch).to receive(:call).and_return(FurnitureSearch::Result.new(products: [], color: "blue", failures: 0, search_entry_points: []))
        end
        run_test!
      end

      response "401", "ログインが必要" do
        schema "$ref" => "#/components/schemas/Unauthorized"
        let(:Authorization) { "" }
        let(:params) { { query: "テーブル" } }
        run_test!
      end

      response "422", "入力または検索の確認に失敗" do
        schema "$ref" => "#/components/schemas/ValidationErrors"
        let(:params) { { query: "" } }
        run_test!
      end
    end
  end
end
