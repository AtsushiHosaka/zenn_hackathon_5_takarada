namespace :furniture_detail do
  desc "Add verified shop colors from FILE without resetting the existing catalog"
  task import_verified_colors: :environment do
    path = ENV.fetch("FILE") { Rails.root.join("db/furniture_details.json").to_s }
    source = JSON.parse(File.read(path))
    puts "Imported #{ShopColorVariantCatalog.call(source)} verified color records (no catalog reset)"
  end
end
