# 非同期処理 (ActiveJob) のバックエンド。キューは Redis に置く。
# REDIS_URL は compose が渡す (ローカル: redis サービス / デプロイ時も同じ compose の redis)。
redis_url = ENV.fetch("REDIS_URL", "redis://redis:6379/0")

Sidekiq.configure_server do |config|
  config.redis = { url: redis_url }
end

Sidekiq.configure_client do |config|
  config.redis = { url: redis_url }
end
