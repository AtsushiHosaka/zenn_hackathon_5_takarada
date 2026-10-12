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
end
