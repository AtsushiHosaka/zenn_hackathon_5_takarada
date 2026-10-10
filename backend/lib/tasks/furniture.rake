namespace :furniture do
  desc "Import furniture (3D model metadata) from db/furnitures.json into furnitures / furniture_bindings"
  task import: :environment do
    path = ENV.fetch("FURNITURES_JSON", Rails.root.join("db/furnitures.json").to_s)
    result = FurnitureImporter.call(path)
    puts "Imported #{result.fetch(:models)} furnitures and #{result.fetch(:bindings)} bindings"
  end
end
