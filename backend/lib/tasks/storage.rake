require "net/http"

# 署名付き URL が Cloud Run の鍵なしサービスアカウントで通るかを確かめる。
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
    upload = RoomPhoto.issue([ { content_type: "image/jpeg", size: body.bytesize } ]).first
    asset = RoomPhoto.asset(upload.key)
    puts "\nasset #{asset.uri}"
    puts "署名OK  #{upload.upload_url[0, 110]}..."

    puts "PUT     #{put(upload.upload_url, body)} (200 なら署名が通っている)"

    meta = client.metadata(asset)
    abort "アップロードしたのに見つかりません" unless meta
    puts "実物    #{meta.size} bytes / #{meta.content_type}"
    abort "大きさが合いません" unless meta.size == body.bytesize

    # 署名した size と違う中身は通らないはず (Content-Length の署名が効いているか)
    mismatch = client.upload_url(asset, content_type: "image/jpeg", size: body.bytesize + 999, expires: RoomPhoto::URL_TTL)
    puts "size不一致 #{put(mismatch, body)} (403 なら上限が強制できている)"

    client.delete(asset)
    puts "後片付け #{client.metadata(asset).inspect}"
    puts "\nOK"
  end

  # 署名したヘッダと完全に一致させる。余計なヘッダを足すと 403 になる
  def put(url, body)
    uri = URI(url)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |session|
      request = Net::HTTP::Put.new(uri)
      request["Content-Type"] = "image/jpeg"
      request.body = body
      session.request(request)
    end
    "#{response.code} #{response.message}"
  end
end
