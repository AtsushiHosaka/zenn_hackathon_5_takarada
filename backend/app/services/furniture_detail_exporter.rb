# furniture_details を db/furniture_details.json の形にする (FurnitureDetailImporter の逆)。控えと、初期データの更新に使う。
# 並びは position 順。取り込むと先頭から 0, 1, 2… と振り直すので順序は同じになる。非表示の detail は出さない
class FurnitureDetailExporter
  def self.call
    details = FurnitureDetail.available.preload(furniture: :model, detail_textures: :furniture_texture).order(:position, :id)
    { "details" => details.map { |detail| row(detail) } }
  end

  def self.row(detail)
    textures = detail.detail_textures.to_h { |texture| [ texture.material_key, texture.furniture_texture.texture_key ] }
    {
      "key" => detail.key, "name" => detail.name, "category" => detail.category, "kind" => detail.kind, "slot" => detail.slot,
      "model_key" => detail.furniture.model.model_key, "symbolic_color" => detail.symbolic_color,
      "color_materials" => detail.color_materials, "color_name" => detail.color_name, "size" => detail.size,
      "estimated_axes" => detail.estimated_axes, "material" => detail.material, "shape" => detail.shape,
      "price" => detail.price, "shop" => detail.shop, "url" => detail.url, "image_url" => detail.image_url,
      "themes" => detail.themes
    }.merge(textures.present? ? { "texture_materials" => textures } : {})
  end
end
