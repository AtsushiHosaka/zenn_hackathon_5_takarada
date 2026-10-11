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
  # 推定した辺は商品ではなく 3D モデルが持つので、ここでは移さない (furniture:import が db/furnitures.json から入れる)
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
      rows = JSON.parse(File.read(Rails.root.join("db/furniture_details.json"))).fetch("details")
      updated = rows.sum do |row|
        connection.update("UPDATE furniture_details SET material = #{connection.quote(row['material'])} WHERE key = #{connection.quote(row['key'])}")
      end
      puts "Moved furniture_details.metadata into columns (#{updated} rows got material from db/furniture_details.json)"
    end
  end
end
