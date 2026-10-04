require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
# 部屋の写真の保存 (config/storage.yml)
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
# require "action_mailbox/engine"
# require "action_text/engine"
require "action_view/railtie"
# require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

# Zeitwerk の管理外 (下で ignore 指定) なので明示的に読む
require_relative "../lib/middleware/origin_guard"

module App
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.0

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks middleware])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # ORIGIN_SECRET が設定されているときだけ、共有シークレット付きのリクエストに限定する。
    # 現構成 (Cloud Run) では未設定なので素通し (lib/middleware/origin_guard.rb 参照)
    config.middleware.insert_before 0, OriginGuard

    # 非同期処理は Sidekiq (Redis) 経由。test だけ config/environments/test.rb で
    # :test アダプタに差し替えるので、spec の実行に Redis は要らない
    config.active_job.queue_adapter = :sidekiq

    # 部屋の写真の保存先 (config/storage.yml)。本番も GCS 対応まではローカルのディスク
    config.active_storage.service = :local

    # スキーマは ridgepole (db/Schemafile) で管理するため、マイグレーションは生成しない
    config.generators do |g|
      g.orm :active_record, migration: false
    end

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true
  end
end
