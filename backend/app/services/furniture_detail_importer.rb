require "json"

# db/furniture_details.json (家具の色・寸法・購入リンク) を furniture_details に取り込む。
# JSON を正とし、載っていない detail は消す。家具は先に FurnitureImporter で入れておく。
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

    furnitures = Furniture.where(model_key: rows.map { |row| row["model_key"] }).index_by(&:model_key)
    FurnitureDetail.transaction do
      keys = rows.each_with_index.map do |row, index|
        furniture = furnitures[row["model_key"]] or raise InvalidDetails, "details[#{index}].model_key #{row["model_key"].inspect} is not imported"
        size = row["size"].to_h
        detail = FurnitureDetail.find_or_initialize_by(key: row["key"])
        detail.update!(
          furniture:, position: index,
          **row.slice("name", "category", "slot", "color", "color_name", "price", "shop", "url", "image_url", "themes", "metadata", "checked_at").symbolize_keys,
          width: size["w"], height: size["h"], depth: size["d"]
        )
        detail.key
      rescue ActiveRecord::RecordInvalid => error
        raise InvalidDetails, "details[#{index}] (#{row['key']}): #{error.record.errors.full_messages.join(', ')}"
      end
      FurnitureDetail.where.not(key: keys).delete_all
      { details: keys.size, furnitures: rows.map { |row| row["model_key"] }.uniq.size }
    end
  end
end
