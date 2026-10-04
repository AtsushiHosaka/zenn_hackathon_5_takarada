namespace :furniture_models do
  desc "Import the furniture GLB metadata manifest into the database"
  task import: :environment do
    path = ENV.fetch("FURNITURE_MODEL_MANIFEST", Rails.root.join("db/furniture_models.json").to_s)
    result = FurnitureModelImporter.call(path)
    puts "Imported #{result.fetch(:models)} furniture models and #{result.fetch(:bindings)} bindings"
  end
end
