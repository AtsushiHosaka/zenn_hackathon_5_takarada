# GCS との境界。参照は Asset (値オブジェクト)、通信はクライアントが持つ。
# **何を置くかはここでは決めない**: 部屋写真の規則は RoomPhoto、
# 3D モデルの対応は ModelResolver が持つ。
module Storage
  Metadata = Data.define(:size, :content_type)

  class << self
    # バケット名が無ければ nil (未設定の環境でも落とさない)
    def asset(bucket, key)
      bucket.presence && Asset.new(bucket: bucket, key: key)
    end

    def client
      Rails.env.local? ? LocalClient.new : GcsClient.new
    end
  end
end
