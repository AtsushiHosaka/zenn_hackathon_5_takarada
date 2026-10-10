# furniture_details を db/furniture_details.json の形にする (FurnitureDetailImporter の逆)。
# 並びは position 順で、取り込むと同じ並び順になる。非表示の detail は出さない
class FurnitureDetailExporter
  def self.call
    details = FurnitureDetail.available.includes(furniture: :model, detail_textures: :furniture_texture).order(:position, :id)
    { "details" => details.map { |detail| row(detail) } }
  end

  def self.row(detail)
    textures = detail.detail_textures.to_h { |texture| [ texture.material_key, texture.furniture_texture.texture_key ] }
    {
      "key" => detail.key, "name" => detail.name, "category" => detail.category, "slot" => detail.slot,
      "model_key" => detail.furniture.model.model_key, "symbolic_color" => detail.symbolic_color,
      "color_materials" => detail.color_materials, "color_name" => detail.color_name, "size" => detail.size,
      "price" => detail.price, "shop" => detail.shop, "url" => detail.url, "image_url" => detail.image_url,
      "themes" => detail.themes, "metadata" => detail.metadata, "checked_at" => detail.checked_at&.iso8601
    }.merge(textures.present? ? { "texture_materials" => textures } : {})
  end
end
