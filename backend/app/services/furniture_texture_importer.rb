require "json"

# db/furniture_textures.json (模様の一覧) を furniture_textures に取り込む。JSON を正とし、載っていない模様は消す
class FurnitureTextureImporter
  class InvalidTextures < StandardError; end

  def self.call(path = Rails.root.join("db/furniture_textures.json"))
    new(JSON.parse(File.read(path))).call
  rescue JSON::ParserError => error
    raise InvalidTextures, "Invalid JSON: #{error.message}"
  end

  def initialize(source)
    @source = source
  end

  def call
    rows = @source.is_a?(Hash) && @source["textures"]
    raise InvalidTextures, "textures must be an array" unless rows.is_a?(Array)

    FurnitureTexture.transaction do
      keys = rows.each_with_index.map do |row, index|
        texture = FurnitureTexture.find_or_initialize_by(texture_key: row["texture_key"])
        texture.update!(row.slice("name", "tile_size_m", "tinted"))
        texture.texture_key
      rescue ActiveRecord::RecordInvalid => error
        raise InvalidTextures, "textures[#{index}] (#{row['texture_key']}): #{error.record.errors.full_messages.join(', ')}"
      end
      removed = FurnitureTexture.where.not(texture_key: keys)
      FurnitureDetailTexture.where(furniture_texture: removed).delete_all
      removed.delete_all
      { textures: keys.size }
    end
  end
end
