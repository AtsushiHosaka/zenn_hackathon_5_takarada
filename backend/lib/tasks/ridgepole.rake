SCHEMAFILE = "db/Schemafile".freeze

def ridgepole(*args)
  env = ENV.fetch("RAILS_ENV", "development")
  sh "bundle exec ridgepole -c config/database.yml -E #{env} -f #{SCHEMAFILE} #{args.join(' ')}"
end

namespace :db do
  desc "db/Schemafile を DB に適用する"
  task :apply do
    ridgepole "--apply"
  end

  desc "db/Schemafile と DB の差分を表示する (適用はしない)"
  task :dry_run do
    ridgepole "--apply", "--dry-run"
  end

  desc "現在の DB の状態を db/Schemafile に書き出す"
  task :export do
    ridgepole "--export"
  end
end
