namespace :furniture_texture do
  desc "Import static textures from db/furniture_textures.json. Run before furniture_detail:import"
  task import: :environment do
    path = ENV.fetch("FURNITURE_TEXTURES_JSON", Rails.root.join("db/furniture_textures.json").to_s)
    result = FurnitureTextureImporter.call(path)
    puts "Imported #{result.fetch(:textures)} furniture textures"
  end

  # 生成画像の記録を持つ旧 furniture_textures は列がまったく違うため、db:apply の前に行を消す。新しい形なら何もしない
  desc "Clear rows of the legacy generated-texture table before db:apply"
  task clear_legacy: :environment do
    connection = ActiveRecord::Base.connection
    if connection.table_exists?(:furniture_textures) && connection.column_exists?(:furniture_textures, :generation_key)
      puts "Deleted #{connection.delete('DELETE FROM furniture_textures')} legacy furniture textures"
    end
  end
end
