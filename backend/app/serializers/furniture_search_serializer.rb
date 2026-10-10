class FurnitureSearchSerializer
  include Alba::Resource

  attributes :color
  attribute :products do |result|
    result.products.map do |product|
      FurnitureSearchSerializer.detail_attributes(product.detail).merge(
        "variants" => product.variants.map { |detail| FurnitureSearchSerializer.detail_attributes(detail) }
      )
    end
  end

  def self.detail_attributes(detail)
    detail.scene_attributes.except("label", "texture_status")
      .merge("name" => detail.name, "furniture_id" => detail.furniture_id, "color_name" => detail.color_name)
  end
end
