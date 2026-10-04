# GCS との境界。バケットは公開 (3D モデル) と非公開 (部屋写真) の 2 つ。
# uniform bucket-level access では allUsers がバケット全体に効くため prefix では分けられない。
#
#   Storage.model(key)&.url                => Scene の model_url
#   Storage.photo(key).uri                 => gs:// (写真解析の LLM へ渡す)
#   Storage.client.upload_url(asset, ...)  => ブラウザが直接 PUT する署名付き URL
module Storage
  PHOTO_EXTENSIONS = { "image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp" }.freeze
  MAX_PHOTO_BYTES = 10 * 1024 * 1024
  UPLOAD_URL_TTL = 600

  Metadata = Data.define(:size, :content_type)

  class << self
    # バケット未設定なら nil。model_url が null でもクライアントは箱で描ける
    def model(key)
      bucket = ENV["MODELS_BUCKET"].presence
      bucket && Asset.new(bucket: bucket, key: key)
    end

    def photo(key)
      Asset.new(bucket: ENV.fetch("UPLOADS_BUCKET"), key: key)
    end

    def client
      Rails.env.local? ? LocalClient.new : GcsClient.new
    end

    # Room はまだ無いので uuid_v7 で束ねる。key をサーバが決めることで
    # 他人の写真の上書きもパストラバーサルも起きない
    def photo_keys(content_types)
      prefix = SecureRandom.uuid_v7
      content_types.map.with_index do |content_type, index|
        "photos/#{prefix}/#{index}.#{PHOTO_EXTENSIONS.fetch(content_type)}"
      end
    end
  end
end
