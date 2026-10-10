require "json"

# db/furniture_details.json (家具の色・寸法・購入リンク) を furniture_details に取り込む。
# JSON を正とし、載っていない detail は消す。家具と模様は先に FurnitureImporter / FurnitureTextureImporter で入れておく。
# texture_materials は部位ごとの模様 ({"tint": "linen"})。
class FurnitureDetailImporter
  class InvalidDetails < StandardError; end

  def self.call(path = Rails.root.join("db/furniture_details.json"))
    new(JSON.parse(File.read(path))).call
  rescue JSON::ParserError => error
    raise InvalidDetails, "Invalid JSON: #{error.message}"
  end

  def initialize(source)
    @source = source
  end

  def call
    rows = @source.is_a?(Hash) && @source["details"]
    raise InvalidDetails, "details must be an array" unless rows.is_a?(Array)

    furnitures = Furniture3DModel.includes(:furniture).where(model_key: rows.map { |row| row["model_key"] }).to_h { |model| [ model.model_key, model.furniture ] }
    textures = FurnitureTexture.all.index_by(&:texture_key)
    FurnitureDetail.transaction do
      keys = rows.each_with_index.map do |row, index|
        furniture = furnitures[row["model_key"]] or raise InvalidDetails, "details[#{index}].model_key #{row["model_key"].inspect} is not imported"
        size = row["size"].to_h
        detail = FurnitureDetail.find_or_initialize_by(key: row["key"])
        detail.update!(
          furniture:, position: index,
          **row.slice("name", "category", "slot", "symbolic_color", "color_materials", "color_name", "price", "shop", "url", "image_url", "themes", "metadata", "checked_at").symbolize_keys,
          width: size["w"], height: size["h"], depth: size["d"]
        )
        detail.detail_textures.delete_all
        row.fetch("texture_materials", {}).each do |material_key, texture_key|
          texture = textures[texture_key] or raise InvalidDetails, "details[#{index}].texture_materials #{texture_key.inspect} is not imported"
          detail.detail_textures.create!(furniture_texture: texture, material_key:)
        end
        detail.key
      rescue ActiveRecord::RecordInvalid => error
        raise InvalidDetails, "details[#{index}] (#{row['key']}): #{error.record.errors.full_messages.join(', ')}"
      end
      removed = FurnitureDetail.where.not(key: keys)
      FurnitureDetailTexture.where(furniture_detail: removed).delete_all
      removed.delete_all
      { details: keys.size, furnitures: rows.map { |row| row["model_key"] }.uniq.size }
    end
  end
end
