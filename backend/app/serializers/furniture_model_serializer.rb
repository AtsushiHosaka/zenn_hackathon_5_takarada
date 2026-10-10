# 3D モデルと、それを持つ家具の名前・種類・キャラクター・権利表記
class FurnitureModelSerializer
  include Alba::Resource

  attribute(:name) { |model| model.furniture.name }
  attribute(:category) { |model| model.furniture.category }
  attributes :shape, :variant, :format, :object_key,
             :triangle_count, :byte_size, :sha256, :color_material_keys
  attribute(:id) { |model| model.model_key }
  attribute(:size) { |model| { w: model.width.to_f, h: model.height.to_f, d: model.depth.to_f } }
  attribute(:unit) { Furniture3DModel::UNIT }
  attribute(:axes) { Furniture3DModel::AXES }
  attribute(:model_url) { |model| model.url(base: model_base_url) }
  attribute(:characters) { |model| model.furniture.characters.map(&:character_key) }
  attribute(:credits) { |model| FurnitureModelSerializer.credits(model.furniture) }

  # キャラクターのフランチャイズごとの権利表記。モデルを表示する画面で併記する
  def self.credits(furniture)
    furniture.characters.map(&:franchise).uniq.map(&:credit_attributes)
  end

  private

  def model_base_url
    return @model_base_url if defined?(@model_base_url)

    @model_base_url = Furniture3DModel.asset_base_url
  end
end
