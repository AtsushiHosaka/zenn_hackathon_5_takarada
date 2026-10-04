module Storage
  # 開発・テスト用。GCS の代わりに tmp/storage/<bucket>/<key> へ置き、
  # 署名の代わりに dev 限定の受け口を指す URL を返す
  # (本番と同じ uploads -> PUT -> rooms の 3 段で試せる)
  class LocalClient
    def upload_url(asset, content_type: nil, size: nil, expires: nil)
      token = Rails.application.message_verifier(:local_upload).generate(
        { "key" => asset.key, "content_type" => content_type, "size" => size },
        expires_in: expires, purpose: :room_photo
      )
      "#{ENV.fetch('DEV_API_ORIGIN', 'http://localhost:3000')}/api/v1/uploads/#{asset.key}?token=#{ERB::Util.url_encode(token)}"
    end

    # 受け口から呼ばれる。GCS が直接受ける本番側には対応するものが無い
    def store(asset, bytes)
      path = path_for(asset)
      path.dirname.mkpath
      path.binwrite(bytes)
      asset
    end

    def metadata(asset)
      path = path_for(asset)
      path.exist? ? Metadata.new(size: path.size, content_type: content_type_for(asset)) : nil
    end

    def delete(asset)
      path_for(asset).delete if path_for(asset).exist?
    end

    def download(asset)
      path = path_for(asset)
      path.binread if path.exist?
    end

    private

    def path_for(asset)
      Rails.root.join("tmp/storage", asset.bucket, asset.key).cleanpath
    end

    # key の拡張子から引き直せるので脇にメタ情報を置かない
    def content_type_for(asset)
      RoomPhoto::CONTENT_TYPES.invert[File.extname(asset.key).delete_prefix(".")]
    end
  end
end
