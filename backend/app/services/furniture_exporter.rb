# furnitures / furniture_3d_models を db/furnitures.json の形にする (FurnitureImporter の逆)。控えと、初期データの更新に使う。
# 並びは model_key 順。無効にした家具も出す (取り込んでも有効・無効は変えない)
class FurnitureExporter
  def self.call
    models = Furniture3DModel.preload(furniture: :characters).order(:model_key)
    { "unit" => Furniture3DModel::UNIT, "axes" => Furniture3DModel::AXES, "models" => models.map { |model| row(model) } }
  end

  def self.row(model)
    {
      "id" => model.model_key, "name" => model.furniture.name, "category" => model.furniture.category,
      "shape" => model.shape, "variant" => model.variant, "format" => model.format, "object_key" => model.object_key,
      "size" => [ model.width, model.height, model.depth ].map(&:to_f), "triangles" => model.triangle_count,
      "color_material_keys" => model.color_material_keys, "bytes" => model.byte_size, "sha256" => model.sha256,
      "characters" => model.furniture.characters.map(&:character_key).sort
    }
  end
end
