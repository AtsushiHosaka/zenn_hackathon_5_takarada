require "swagger_helper"

RSpec.describe "Api::V1::FurnitureSearches", type: :request do
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }

  path "/api/v1/furniture_searches" do
    post "登録された家具を検索し色で絞り込む" do
      tags "FurnitureSearches"
      description "DBに登録された家具 (furniture_details) を検索する。外部ECは検索しない。商品名に検索語を含むものを優先し、無ければ推定したカテゴリ (なければ床置き家具) 全体を返す。色は公式の色名・商品名で絞り込む。家具ごとに1件で最大24件。同じ家具の他の色・寸法・購入先はvariantsに入る。"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/FurnitureSearchInput" }

      response "200", "検索結果" do
        schema "$ref" => "#/components/schemas/FurnitureSearchResult"
        let(:params) { { query: "テーブル", color: "blue" } }
        before do
          FurnitureImporter.call
          furniture = Furniture.find_by!(key: "table_low_rect")
          FurnitureDetail.create!(key: "spec:table", furniture:, name: "ローテーブル ブルー", category: "table", slot: "floor", color: "#778da6",
                                  color_name: "ブルー", width: 0.9, height: 0.38, depth: 0.5, price: 9990, shop: "IKEA", url: "https://www.ikea.com/jp/ja/p/example-table-12345678/")
        end
        run_test! do |response|
          products = JSON.parse(response.body)["products"]
          expect(products.map { |product| product["name"] }).to eq([ "ローテーブル ブルー" ])
          expect(products.first["variants"].size).to eq(1)
        end
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
