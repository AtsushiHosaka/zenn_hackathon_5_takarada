require "net/http"

# 署名付き URL が Cloud Run の鍵なしサービスアカウントで実際に通るかを確かめる。
# ローカルは LocalClient に落ちるので、本番の経路を見るには Cloud Run で流す:
#   make infra-task T=storage:verify
namespace :storage do
  desc "署名付き URL で PUT -> 実物を確認 -> 後片付け"
  task verify: :environment do
    client = Storage.client
    puts "client               #{client.class}"
    puts "MODELS_BUCKET        #{ENV['MODELS_BUCKET'].inspect}"
    puts "UPLOADS_BUCKET       #{ENV['UPLOADS_BUCKET'].inspect}"
    puts "STORAGE_SIGNER_EMAIL #{ENV['STORAGE_SIGNER_EMAIL'].inspect}"

    body = "verify-#{Time.now.utc.iso8601}"
    content_type = "image/jpeg"
    asset = Storage.photo(Storage.photo_keys([ content_type ]).first)
    puts "\nasset #{asset.uri}"

    url = client.upload_url(asset, content_type: content_type, size: body.bytesize)
    puts "署名OK  #{url[0, 120]}..."

    uri = URI(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    # 署名したヘッダと完全に一致させる。余計なヘッダを足すと 403 になる
    response = http.request(Net::HTTP::Put.new(uri).tap do |request|
      request["Content-Type"] = content_type
      request.body = body
    end)
    puts "PUT     #{response.code} #{response.message}"
    abort "PUT が失敗しました:\n#{response.body}" unless response.is_a?(Net::HTTPSuccess)

    meta = client.metadata(asset)
    abort "アップロードしたのに見つかりません" unless meta
    puts "実物    #{meta.size} bytes / #{meta.content_type}"
    abort "大きさが合いません" unless meta.size == body.bytesize

    # 上限超過を弾けるか (署名した size と違う中身は通らないはず)
    short = client.upload_url(asset, content_type: content_type, size: body.bytesize + 999)
    bad = URI(short)
    mismatch = Net::HTTP.start(bad.host, bad.port, use_ssl: true) do |session|
      session.request(Net::HTTP::Put.new(bad).tap do |request|
        request["Content-Type"] = content_type
        request.body = body
      end)
    end
    puts "size不一致 #{mismatch.code} (403 なら Content-Length の署名が効いている)"

    client.delete(asset)
    puts "後片付け #{client.metadata(asset).inspect}"
    puts "\nOK"
  end
end
