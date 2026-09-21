require "spec_helper"
# コンテナ内は RAILS_ENV=development なので、テスト時は強制的に test に切り替える
ENV["RAILS_ENV"] = "test"
require_relative "../config/environment"

abort("The Rails environment is running in production mode!") if Rails.env.production?

require "rspec/rails"
require "ridgepole"

# テスト DB を db/Schemafile に追従させる (差分がなければ何もしない)。
# マイグレーションは使わないので maintain_test_schema! の代わり。
def apply_schemafile!
  Ridgepole::Client
    .new(ActiveRecord::Base.connection_db_config.configuration_hash)
    .diff(Rails.root.join("db/Schemafile").read)
    .migrate
end

begin
  apply_schemafile!
rescue ActiveRecord::NoDatabaseError
  ActiveRecord::Tasks::DatabaseTasks.create_current
  apply_schemafile!
end

Dir[Rails.root.join("spec/support/**/*.rb")].each { |f| require f }

RSpec.configure do |config|
  config.fixture_paths = [ Rails.root.join("spec/fixtures") ]
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include AuthHelper
end
