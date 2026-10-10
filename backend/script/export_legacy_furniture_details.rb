# 旧テーブル (ec_products / furniture_model_bindings / furniture_models) を読み、db/furniture_details.json に書き込む。
# 旧テーブルを Schemafile から消す前に、Cloud SQL へ読み取り専用でつないで一度だけ流す移行用スクリプト。
#
#   LEGACY_DATABASE_URL=postgres://app:<password>@<host>:5432/app_production \
#     bin/rails runner script/export_legacy_furniture_details.rb
#
# 既に JSON にある detail は、手で決めた家具 (model_key)・テーマ・並び順を保ち、他の項目を旧DBの値で更新する。
# 新しい商品の家具は FURNITURE_OVERRIDES、なければ旧DBの照合結果 (furniture_model_bindings) を使い、どちらも無ければ報告して入れない。
# 手入力の detail (key が static:) はそのまま残す。旧DBで見つからない EC の detail は消さずに残し、件数を報告する。
require "json"

EXCLUDED = {
  4 => "パズルマットをラグとして取得", 34 => "マットレスプロテクターをベッドとして取得",
  49 => "デスクチェアをデスクとして取得", 64 => "ペンダントランプをカーテンとして取得",
  81 => "ペンダントライトをフロアランプとして取得", 83 => "ペンダントランプをフロアランプとして取得",
  84 => "ペンダントランプをタペストリーとして取得", 86 => "飾り棚をタペストリーとして取得",
  87 => "飾り棚をタペストリーとして取得", 98 => "ランプシェードをベッドカバーとして取得",
  74 => "奥行きが幅と同じ値で取得されている", 79 => "奥行きが幅と同じ値で取得されている",
  85 => "奥行きが幅と同じ値で取得されている"
}.freeze
# 寸法比の自動照合が外れた・似ていないモデルを選んだ商品は、商品名から家具を決める (ec_products.id => furniture_3d_models.model_key)
FURNITURE_OVERRIDES = {
  1 => "cushion", 62 => "cushion", 66 => "cushion", 80 => "cushion", 89 => "cushion", 90 => "cushion", 91 => "cushion",
  7 => "rug_rect", 70 => "bed_cover", 42 => "table_dining_rect", 60 => "table_lamp", 93 => "table_lamp", 95 => "desk_lamp_arm",
  9 => "chair_folding", 18 => "chair_folding", 30 => "chair_folding", 13 => "chair_dining", 12 => "chair_dining", 16 => "chair_dining",
  11 => "stool_round", 51 => "stool_round", 14 => "stool_round", 17 => "stool_round", 25 => "stool_round", 26 => "stool_round",
  15 => "chair_gaming", 19 => "chair_office", 41 => "chair_office", 24 => "armchair_wing", 28 => "chair_lounge", 47 => "chair_lounge",
  31 => "stool_bar", 33 => "chair_shell", 40 => "step_stool"
}.freeze
# metadata はコードが読む項目だけを残す (配置・検索・AI への商品情報)
KEEP_METADATA = %w[provider size estimated_axes official_color shape material color_name].freeze
PATH = Rails.root.join("db/furniture_details.json")

class LegacyRecord < ActiveRecord::Base
  self.abstract_class = true
end
LegacyRecord.establish_connection(ENV.fetch("LEGACY_DATABASE_URL"))
legacy = LegacyRecord.connection
legacy.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
products = legacy.select_all(<<~SQL).to_a
  SELECT e.id, e.provider, e.provider_product_id, e.variant_id, e.source_url, e.data, e.fetched_at, m.key AS bound_furniture
  FROM ec_products e
  LEFT JOIN furniture_model_bindings b ON b.kind = 'product' AND b.reference = (1000000000 + e.id)::text -- 旧 EcProduct::PUBLIC_ID_OFFSET
  LEFT JOIN furniture_models m ON m.id = b.furniture_model_id
  ORDER BY e.id
SQL

current = JSON.parse(File.read(PATH)).fetch("details")
by_key = current.index_by { |detail| detail["key"] }
models = Furniture3DModel.all.index_by(&:model_key)
report = { "excluded" => [], "unassigned" => [], "added" => [], "updated" => [] }
seen = []

products.each do |row|
  id = row["id"]
  data = row["data"].is_a?(String) ? JSON.parse(row["data"]) : row["data"]
  key = "ec:#{row['provider']}:#{row['provider_product_id']}:#{row['variant_id']}"
  if EXCLUDED.key?(id)
    report["excluded"] << "#{id} #{data['name']} (#{EXCLUDED[id]})"
    next
  end

  existing = by_key[key]
  furniture = existing&.fetch("model_key") || FURNITURE_OVERRIDES[id] || row["bound_furniture"]
  unless furniture && models.key?(furniture)
    report["unassigned"] << "#{id} #{data['name']} (#{data['category']})"
    next
  end

  metadata = data.fetch("metadata").slice(*KEEP_METADATA)
  detail = {
    "key" => key, "name" => data["name"], "category" => data["category"], "slot" => data["slot"], "model_key" => furniture,
    "symbolic_color" => data["color"].downcase,
    "color_materials" => { models.fetch(furniture).primary_color_key => data["color"].downcase }, "color_name" => metadata["color_name"].presence, "size" => data["size"],
    "price" => data["price"], "shop" => data["shop"], "url" => row["source_url"], "image_url" => data["image_url"],
    "themes" => existing&.fetch("themes") || [], "metadata" => metadata,
    "checked_at" => data.fetch("metadata")["price_checked_at"] || Time.zone.parse(row["fetched_at"].to_s).iso8601
  }
  report[existing ? "updated" : "added"] << key
  by_key[key] = detail
  seen << key
end

# Keep curated order; new products follow by price.
known = current.map { |detail| by_key.fetch(detail["key"]) }
added = report["added"].map { |key| by_key.fetch(key) }.sort_by { |detail| [ detail["price"], detail["key"] ] }
missing = current.map { |detail| detail["key"] }.select { |key| key.start_with?("ec:") } - seen
File.write(PATH, JSON.pretty_generate({ "details" => known + added }) + "\n")

puts "legacy ec_products=#{products.size} updated=#{report['updated'].size} added=#{report['added'].size} " \
     "excluded=#{report['excluded'].size} unassigned=#{report['unassigned'].size} not_in_legacy=#{missing.size}"
puts "details=#{known.size + added.size}"
report.slice("unassigned").each { |label, rows| rows.each { |row| puts "#{label}: #{row}" } }
missing.each { |key| puts "not_in_legacy: #{key}" }
