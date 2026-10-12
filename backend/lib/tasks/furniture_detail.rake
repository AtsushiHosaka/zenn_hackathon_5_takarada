namespace :furniture_detail do
  desc "Seed furniture details (color, size, purchase link) from db/furniture_details.json when the table is empty. FORCE=1 rebuilds from the JSON. Run furniture:import first"
  task import: :environment do
    path = ENV.fetch("FURNITURE_DETAILS_JSON", Rails.root.join("db/furniture_details.json").to_s)
    result = FurnitureDetailImporter.call(path, force: ENV["FORCE"] == "1")
    if result.fetch(:skipped)
      puts "Skipped furniture details: the table already has rows (the database is the source of truth; FORCE=1 rebuilds from the JSON)"
    else
      puts "Imported #{result.fetch(:details)} furniture details for #{result.fetch(:furnitures)} furnitures"
    end
  end

  # metadata (jsonb) を持つ旧 furniture_details を、material の列へ移す。db:apply が metadata を落とす前に流す。
  # 色名は metadata から移す。短い素材は初期データ (db/furniture_details.json) を key で引いて入れる。新しい形なら何もしない。
  # 推定した辺は商品ではなく 3D モデルが持つ。3D モデルは DB が正で furniture:import は既存の DB を変えないので、
  # ここで furniture_3d_models に列を足し、初期データ (db/furnitures.json) をモデル ID で引いて入れる
  desc "Move legacy furniture_details.metadata into columns before db:apply"
  task migrate_fields: :environment do
    connection = ActiveRecord::Base.connection
    next unless connection.table_exists?(:furniture_details) && connection.column_exists?(:furniture_details, :metadata)

    connection.transaction do
      connection.execute(<<~SQL)
        ALTER TABLE furniture_details
          ADD COLUMN IF NOT EXISTS material character varying
      SQL
      connection.execute(<<~SQL)
        UPDATE furniture_details SET
          material = NULLIF(metadata->>'material', ''),
          color_name = COALESCE(NULLIF(color_name, ''), NULLIF(metadata->>'official_color', ''), NULLIF(metadata->>'color_name', ''))
      SQL
      connection.execute("ALTER TABLE furniture_3d_models ADD COLUMN IF NOT EXISTS estimated_axes jsonb NOT NULL DEFAULT '[]'")
      models = JSON.parse(File.read(Rails.root.join("db/furnitures.json"))).fetch("models").select { |model| model["estimated_axes"].present? }
      axes = models.sum do |model|
        connection.update("UPDATE furniture_3d_models SET estimated_axes = #{connection.quote(model['estimated_axes'].to_json)}::jsonb WHERE model_key = #{connection.quote(model['id'])}")
      end
      rows = JSON.parse(File.read(Rails.root.join("db/furniture_details.json"))).fetch("details")
      updated = rows.sum do |row|
        connection.update("UPDATE furniture_details SET material = #{connection.quote(row['material'])} WHERE key = #{connection.quote(row['key'])}")
      end
      puts "Moved furniture_details.metadata into columns (#{updated} rows got material from db/furniture_details.json, #{axes} models got estimated_axes from db/furnitures.json)"
    end
  end

  # themes が旧い 3 種類 (oshi_purple・botanical・korean) のままの DB を、雰囲気のタグ (FurnitureCandidates::THEMES) に付け直す。
  # 初期データ (db/furniture_details.json) にある商品はそのタグにし、無い商品は oshi_purple を oshi に読み替えて一覧に無いものを外す。
  # 一覧に無いタグが 1 つも無ければ何もしない (管理画面で直したタグを上書きしない)
  desc "Replace legacy furniture_details.themes with the mood tags from db/furniture_details.json"
  task retag_themes: :environment do
    known = FurnitureCandidates::THEMES.keys
    legacy = FurnitureDetail.pluck(:id, :themes).select { |_, themes| (Array(themes) - known).any? }
    next if legacy.empty?

    tags = JSON.parse(File.read(Rails.root.join("db/furniture_details.json"))).fetch("details").to_h { |row| [ row["key"], row["themes"] ] }
    FurnitureDetail.transaction do
      FurnitureDetail.find_each do |detail|
        themes = tags[detail.key] || (detail.themes.map { |theme| theme == "oshi_purple" ? "oshi" : theme } & known)
        detail.update_columns(themes:, updated_at: Time.current) if themes != detail.themes
      end
    end
    puts "Retagged furniture details (#{legacy.size} rows had legacy themes)"
  end
end
