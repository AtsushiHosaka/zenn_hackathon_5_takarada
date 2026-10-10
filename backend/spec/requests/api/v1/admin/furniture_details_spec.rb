require "swagger_helper"

RSpec.describe "Api::V1::Admin::FurnitureDetails", type: :request do
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }

  before do
    CharacterImporter.call
    FurnitureImporter.call
    FurnitureTextureImporter.call
    FurnitureDetailImporter.call
  end

  around do |example|
    previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = admin_emails
    example.run
  ensure
    ENV["ADMIN_EMAILS"] = previous
  end
  let(:admin_emails) { current.email }

  path "/api/v1/admin/furniture_details" do
    get "商品 (家具の色・寸法・購入リンク) を非表示のものも含めて一覧で取得する" do
      tags "Admin"
      description "ADMIN_EMAILS に入っている人だけが使える。"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "商品の一覧と、選べる枠・種類" do
        schema "$ref" => "#/components/schemas/AdminFurnitureDetailList"

        run_test!
      end

      response "403", "管理者ではない" do
        schema "$ref" => "#/components/schemas/Forbidden"
        let(:admin_emails) { "" }

        run_test!
      end
    end

    post "商品を登録する" do
      tags "Admin"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/AdminFurnitureDetailInput" }

      response "201", "登録に成功" do
        schema "$ref" => "#/components/schemas/AdminFurnitureDetail"
        let(:source) { FurnitureDetail.order(:id).first }
        let(:params) do
          { furniture_detail: { name: "管理画面で足した商品", category: source.category, slot: source.slot, model_key: source.furniture.model.model_key,
                                symbolic_color: "#112233", color_materials: source.color_materials, size: source.size, price: 1200,
                                shop: "IKEA", url: "https://example.com/item", image_url: nil, themes: [], position: 0, enabled: true } }
        end

        run_test! do
          # 管理画面で足した商品は、JSON に無くても取り込みで消えない
          FurnitureDetailImporter.call
          expect(FurnitureDetail.where(name: "管理画面で足した商品")).to exist
        end
      end
    end
  end

  path "/api/v1/admin/furniture_details/{id}" do
    parameter name: :id, in: :path, type: :integer, required: true

    patch "商品を編集する" do
      tags "Admin"
      description "保存した商品には admin_edited_at が入り、以後 furniture_detail:import は上書きしない。"
      security [ { bearerAuth: [] } ]
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/AdminFurnitureDetailInput" }
      let(:id) { FurnitureDetail.order(:id).first.id }

      response "200", "編集に成功" do
        schema "$ref" => "#/components/schemas/AdminFurnitureDetail"
        let(:params) { { furniture_detail: { price: 4321, enabled: false } } }

        run_test! do
          FurnitureDetailImporter.call
          expect(FurnitureDetail.find(id)).to have_attributes(price: 4321, enabled: false)
        end
      end

      response "422", "値が不正" do
        schema "$ref" => "#/components/schemas/ValidationErrors"
        let(:params) { { furniture_detail: { price: 0 } } }

        run_test!
      end
    end
  end

  path "/api/v1/admin/furniture_details/export" do
    get "商品を db/furniture_details.json の形で書き出す" do
      tags "Admin"
      description "管理画面での編集をリポジトリの JSON に戻すときに使う。非表示の商品は含まない。"
      security [ { bearerAuth: [] } ]
      produces "application/json"

      response "200", "db/furniture_details.json と同じ形" do
        schema "$ref" => "#/components/schemas/AdminFurnitureDetailExport"

        run_test! do |response|
          # 書き出した JSON をそのまま取り込める
          expect(FurnitureDetailImporter.new(JSON.parse(response.body)).call).to include(details: FurnitureDetail.count)
        end
      end
    end
  end
end
