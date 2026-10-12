# furniture_details を db/furniture_details.json の形にする (FurnitureDetailImporter の逆)。控えと、初期データの更新に使う。
# 並びは position 順。取り込むと先頭から 0, 1, 2… と振り直すので順序は同じになる。非表示の detail は出さない
class FurnitureDetailExporter
  def self.call
    details = FurnitureDetail.available.preload(furniture: :model, detail_textures: :furniture_texture).order(:position, :id)
    { "details" => details.map { |detail| row(detail) } }
  end

  def self.row(detail)
    textures = detail.detail_textures.to_h { |texture| [ texture.material_key, texture.furniture_texture.texture_key ] }
    retail = if detail.verified_retail_variant?
      { "retail_family_key" => detail.retail_family_key, "retail_variant_key" => detail.retail_variant_key,
        "retail_source_url" => detail.retail_source_url, "retail_checked_at" => detail.retail_checked_at.iso8601, "retail_availability" => detail.retail_availability }
    else
      {}
    end
    {
      "key" => detail.key, "name" => detail.name, "category" => detail.category, "slot" => detail.slot,
      "model_key" => detail.furniture.model.model_key, "symbolic_color" => detail.symbolic_color,
      "color_materials" => detail.color_materials, "color_name" => detail.color_name, "size" => detail.size,
      "material" => detail.material,
      "price" => detail.price, "shop" => detail.shop, "url" => detail.url, "image_url" => detail.image_url,
      "themes" => detail.themes
    }.merge(retail).merge(textures.present? ? { "texture_materials" => textures } : {})
  end
end
