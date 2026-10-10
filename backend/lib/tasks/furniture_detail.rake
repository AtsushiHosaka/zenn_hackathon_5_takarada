namespace :furniture_detail do
  desc "Import furniture details (color, size, purchase link) from db/furniture_details.json. Run furniture:import first"
  task import: :environment do
    path = ENV.fetch("FURNITURE_DETAILS_JSON", Rails.root.join("db/furniture_details.json").to_s)
    result = FurnitureDetailImporter.call(path)
    puts "Imported #{result.fetch(:details)} furniture details for #{result.fetch(:furnitures)} furnitures"
  end
end
