namespace :furniture do
  desc "Import furniture and 3D models from db/furnitures.json into furnitures / furniture_3d_models"
  task import: :environment do
    path = ENV.fetch("FURNITURES_JSON", Rails.root.join("db/furnitures.json").to_s)
    result = FurnitureImporter.call(path)
    puts "Imported #{result.fetch(:models)} furnitures"
  end
end
