require "swagger_helper"

RSpec.describe "Api::V1::FurnitureImports", type: :request do
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }

  path "/api/v1/furniture_imports" do
    post "商品リンクから所有家具の情報を取得する" do
      tags "FurnitureImports"
      description "対応ショップの商品詳細HTMLを取得・検証する。取得と解析は最大45秒。実商品名・円価格・寸法の根拠を確認できない場合や対応外カテゴリは422。未掲載の寸法は推定軸として明示する。モデルが無い場合はnullを返す。購入提案や予算の合計には追加しない。"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/FurnitureImportInput" }

      response "201", "商品情報を確認できた" do
        schema "$ref" => "#/components/schemas/ImportedFurniture"
        let(:params) { { url: "https://www.ikea.com/jp/ja/p/example-chair-12345678/" } }
        before do
          product = {
            "@type" => "Product", "name" => "ホワイトチェア", "sku" => "12345678", "url" => params[:url], "color" => "ホワイト", "material" => "木材",
            "image" => { "@type" => "ImageObject", "contentUrl" => "https://www.ikea.com/jp/ja/images/products/teodores-chair-white__0727344_pe735616_s5.jpg" },
            "width" => { "value" => 45, "unitCode" => "CMT" }, "height" => { "value" => 80, "unitCode" => "CMT" }, "depth" => { "value" => 45, "unitCode" => "CMT" },
            "offers" => { "@type" => "Offer", "price" => 7990, "priceCurrency" => "JPY", "availability" => "https://schema.org/InStock", "url" => params[:url] }
          }
          html = "<html><body>税込<script type='application/ld+json'>#{product.to_json}</script></body></html>"
          allow_any_instance_of(InteriorLinks::PageFetcher).to receive(:fetch).with(params[:url])
            .and_return(html: html, url: params[:url], store: InteriorLinks::PageFetcher.store(params[:url]))
        end
        run_test! do |response|
          body = JSON.parse(response.body)
          expect(EcProduct.find(body["ec_product_id"]).source_url).to eq(params[:url])
          expect(body).to include("category" => "chair", "price" => 7990, "size" => { "w" => 0.45, "h" => 0.8, "d" => 0.45 })
          expect(body["image_url"]).to eq("https://www.ikea.com/jp/ja/images/products/teodores-chair-white__0727344_pe735616_s5.jpg")
        end
      end

      response "401", "ログインが必要" do
        schema "$ref" => "#/components/schemas/Unauthorized"
        let(:Authorization) { "" }
        let(:params) { { url: "https://www.ikea.com/jp/ja/p/example-chair-12345678/" } }
        run_test!
      end

      response "422", "商品を取得・確認できない" do
        schema "$ref" => "#/components/schemas/ValidationErrors"
        let(:params) { { url: "http://127.0.0.1/product" } }
        run_test!
      end
    end
  end
end
