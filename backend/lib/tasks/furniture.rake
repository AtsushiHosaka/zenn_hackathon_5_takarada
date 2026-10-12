namespace :furniture do
  desc "Seed furniture and 3D models from db/furnitures.json when the table is empty. FORCE=1 overwrites from the JSON"
  task import: :environment do
    path = ENV.fetch("FURNITURES_JSON", Rails.root.join("db/furnitures.json").to_s)
    result = FurnitureImporter.call(path, force: ENV["FORCE"] == "1")
    if result.fetch(:skipped)
      puts "Skipped furnitures: the table already has rows (the database is the source of truth; FORCE=1 overwrites from the JSON)"
    else
      puts "Imported #{result.fetch(:models)} furnitures"
    end
  end
end
