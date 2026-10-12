namespace :character do
  desc "Import franchises and characters from db/characters.json. Run before furniture:import"
  task import: :environment do
    path = ENV.fetch("CHARACTERS_JSON", Rails.root.join("db/characters.json").to_s)
    result = CharacterImporter.call(path)
    puts "Imported #{result.fetch(:franchises)} franchises and #{result.fetch(:characters)} characters"
  end
end
