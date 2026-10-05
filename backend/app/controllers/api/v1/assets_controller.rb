module Api
  module V1
    # 開発・テストの生成画像だけ配信する。本番は公開GCSを使う。
    class AssetsController < ApplicationController
      skip_before_action :authenticate_identity!, only: :show
      KEY = /\Atextures\/description-seamless-v1\/[0-9a-f]{64}\.(png|jpg|webp)\z/

      def show
        return head :not_found unless Rails.env.local? && params[:key].is_a?(String) && params[:key].match?(KEY)

        asset = Storage.asset(ENV["MODELS_BUCKET"], params[:key])
        bytes = asset && Storage.client.download(asset)
        return head :not_found unless bytes

        mime = { ".png" => "image/png", ".jpg" => "image/jpeg", ".webp" => "image/webp" }.fetch(File.extname(params[:key]))
        send_data bytes, type: mime, disposition: "inline"
      end
    end
  end
end
