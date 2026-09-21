Rswag::Api.configure do |c|
  # swagger/ 配下の OpenAPI ドキュメントを配信する
  c.openapi_root = Rails.root.join("swagger").to_s
end
