require "swagger_helper"

RSpec.describe "Api::V1::Assets", type: :request do
  path "/api/v1/assets/{key}" do
    parameter name: :key, in: :path, type: :string, required: true, description: "textures/description-seamless-v1/<64桁のハッシュ>.png等"

    get "開発環境の生成テクスチャを取得する" do
      tags "Assets"
      description "開発・テスト限定。本番は404となり、SceneObjectのGCS公開texture_urlを使用する。"
      security []
      produces "image/png", "image/jpeg", "image/webp"

      response "200", "生成画像" do
        # rswagのJSON検証へバイナリを渡さず、OpenAPIのcontentとして定義する。
        metadata[:response][:content] = %w[image/png image/jpeg image/webp].to_h do |mime|
          [ mime, { schema: { type: :string, format: :binary } } ]
        end
        let(:key) { "textures/description-seamless-v1/#{'a' * 64}.png" }
        let(:asset) { Storage.asset("ec-contract-test", key) }
        around do |example|
          previous = ENV["MODELS_BUCKET"]
          ENV["MODELS_BUCKET"] = "ec-contract-test"
          Storage.client.store(asset, "\x89PNG\r\n\x1a\n".b, content_type: "image/png")
          example.run
        ensure
          Storage.client.delete(asset)
          ENV["MODELS_BUCKET"] = previous
        end
        run_test!
      end
    end
  end
end
