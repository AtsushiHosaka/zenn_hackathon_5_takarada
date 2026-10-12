require "json"

# db/characters.json (フランチャイズとキャラクター) を franchises / characters に取り込む。
# JSON を正とし、載っていないキャラクター・フランチャイズは消す (グッズとの対応も消える)。
class CharacterImporter
  class InvalidCharacters < StandardError; end

  FRANCHISE_FIELDS = %w[name aliases license license_url credit notice likeness_allowed].freeze
  CHARACTER_FIELDS = %w[name name_en group status color color_source theme_id aliases].freeze

  def self.call(path = Rails.root.join("db/characters.json"))
    new(JSON.parse(File.read(path))).call
  rescue JSON::ParserError => error
    raise InvalidCharacters, "Invalid JSON: #{error.message}"
  end

  def initialize(source)
    @source = source
  end

  def call
    franchises = rows("franchises")
    characters = rows("characters")
    Character.transaction do
      imported = franchises.each_with_index.to_h do |row, index|
        franchise = Franchise.find_or_initialize_by(franchise_key: row["key"])
        save!(franchise, row.slice(*FRANCHISE_FIELDS), "franchises[#{index}]")
        [ franchise.franchise_key, franchise ]
      end
      keys = characters.each_with_index.map do |row, index|
        franchise = imported[row["franchise"]] or raise InvalidCharacters, "characters[#{index}].franchise #{row['franchise'].inspect} is not in franchises"
        character = Character.find_or_initialize_by(character_key: row["key"])
        save!(character, row.slice(*CHARACTER_FIELDS).merge("franchise" => franchise), "characters[#{index}]")
        character.character_key
      end
      removed = Character.where.not(character_key: keys)
      CharacterGoods.where(character: removed).delete_all
      removed.delete_all
      Franchise.where.not(franchise_key: imported.keys).delete_all
      { franchises: imported.size, characters: keys.size }
    end
  end

  private

  def rows(key)
    rows = @source.is_a?(Hash) && @source[key]
    raise InvalidCharacters, "#{key} must be an array" unless rows.is_a?(Array)

    rows
  end

  def save!(record, attributes, label)
    record.update!(attributes)
  rescue ActiveRecord::RecordInvalid => error
    raise InvalidCharacters, "#{label} (#{attributes['name']}): #{error.record.errors.full_messages.join(', ')}"
  end
end
