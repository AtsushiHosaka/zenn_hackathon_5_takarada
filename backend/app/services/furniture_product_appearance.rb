# 提案した商品に家具のモデルを付け、detail の部位ごとの色・模様を material_overrides にする
class FurnitureProductAppearance
  def self.call(scene:, items:)
    new(scene:, items:).call
  end

  def initialize(scene:, items:)
    @scene = scene.deep_dup
    @items = items.deep_dup
  end

  def call
    by_marker = @items.index_by { |item| item["marker"] }
    @scene.fetch("objects", []).each do |object|
      next unless object["source"] == "suggested"

      item = by_marker[object["marker"]]
      next unless item && item["product_metadata"].is_a?(Hash) && item["product_metadata"].present?

      model = Furniture.available.find_by(id: item.dig("product_metadata", "furniture_id"))&.model
      unless model
        object["model_url"] = nil
        object["texture_status"] = item["texture_status"] = "unmatched"
        next
      end
      object["model_match"] = item["model_match"] = { "model_id" => model.id, "reason" => "furniture_detail", "approximate" => true }
      object["model_url"] = model.url
      object["model_size"] = model.size
      object["model_fit"] = "contain"
      object["color"] ||= item["color"]
      overrides = material_overrides(item, model, edited_color: object["color"] == item["color"] ? nil : object["color"])
      object["material_overrides"] = overrides if overrides.present?
      object["texture_status"] = item["texture_status"] = overrides.present? ? "ready" : "disabled"
    end
    { scene: @scene, items: @items }
  end

  private

  # 部位ごとの色に模様を重ねる。画面で色を変えた家具は主な部位をその色にする
  def material_overrides(item, model, edited_color:)
    colors = item.dig("product_metadata", "color_materials").to_h.slice(*model.color_material_keys)
    colors = colors.merge(model.primary_color_key => edited_color) if edited_color&.match?(/\A#[0-9a-f]{6}\z/i) && model.primary_color_key
    overrides = colors.transform_values { |color| { "color" => color } }
    texture_keys = item.dig("product_metadata", "texture_materials").to_h.slice(*model.color_material_keys)
    textures = FurnitureTexture.where(texture_key: texture_keys.values).index_by(&:texture_key)
    texture_keys.each do |material_key, texture_key|
      override = textures[texture_key]&.material_override(colors.fetch(material_key, "#ffffff"))
      overrides[material_key] = override if override
    end
    overrides
  end
end
