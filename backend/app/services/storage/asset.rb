module Storage
  # GCS 上の 1 オブジェクトへの参照。通信はしない。
  # 同じ参照を url (ブラウザ) と uri (Vertex AI) の 2 通りに出すため組で持つ
  Asset = Data.define(:bucket, :key) do
    def url
      "https://storage.googleapis.com/#{bucket}/#{key}"
    end

    def uri
      "gs://#{bucket}/#{key}"
    end
  end
end
