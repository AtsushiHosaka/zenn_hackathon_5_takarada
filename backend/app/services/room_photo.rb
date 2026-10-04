# 部屋写真の受け入れ規則と置き場。実体は GCS の非公開バケット。
#
# 写真は Rails を通さず ブラウザ -> GCS へ直接送る (Cloud Run の 32MB 制限と
# コンテナのメモリを避けるため)。Rails は署名付き URL を出し、上がった実物を確かめる。
module RoomPhoto
  CONTENT_TYPES = { "image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp" }.freeze
  MAX_BYTES = 10 * 1024 * 1024
  MAX_COUNT = 4
  URL_TTL = 600

  # keys が作る形。受け取った key をそのまま信じないために使う
  KEY = %r{\Aphotos/(?:users/\d+/)?[0-9a-f-]{36}/\d+\.(?:jpg|png|webp)\z}

  # 発行結果。key は後で POST /rooms に返してもらう
  Upload = Data.define(:key, :upload_url)

  class << self
    def asset(key)
      Storage.asset(ENV.fetch("UPLOADS_BUCKET"), key)
    end

    # 署名付き URL をまとめて発行する。requested は [{ content_type:, size: }, ...]
    def issue(requested, user:)
      client = Storage.client
      keys(requested.map { |upload| upload[:content_type] }, user: user).zip(requested).map do |key, upload|
        url = client.upload_url(asset(key), content_type: upload[:content_type], size: upload[:size].to_i, expires: URL_TTL)
        Upload.new(key: key, upload_url: url)
      end
    end

    # 申告された key のうち、形式が違う / 実物が無い / 大きすぎるものを返す。
    # 「アップロードし終わった」というクライアントの言葉を確かめずに使わない
    def missing(keys, user:)
      client = Storage.client
      keys.reject do |key|
        next false unless key.is_a?(String) && key.match?(KEY) && key.start_with?("photos/users/#{user.id}/")

        meta = client.metadata(asset(key))
        meta && meta.size.positive? && meta.size <= MAX_BYTES
      end
    end

    private

    # Room はまだ無いので uuid_v7 で束ねる。key をサーバが決めることで
    # 他人の写真の上書きもパストラバーサルも起きない
    def keys(content_types, user:)
      prefix = SecureRandom.uuid_v7
      content_types.map.with_index { |type, index| "photos/users/#{user.id}/#{prefix}/#{index}.#{CONTENT_TYPES.fetch(type)}" }
    end
  end
end
