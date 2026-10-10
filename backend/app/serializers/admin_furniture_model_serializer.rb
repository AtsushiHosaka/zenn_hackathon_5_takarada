# 管理画面用の 3D モデルの表現。無効なものも出し、使っている商品の数を付ける
class AdminFurnitureModelSerializer
  include Alba::Resource

  attribute(:id) { |model| model.model_key }
  attribute(:name) { |model| model.furniture.name }
  attribute(:category) { |model| model.furniture.category }
  attributes :shape, :variant, :size, :color_material_keys, :object_key
  attribute(:model_url) { |model| model.url }
  attribute(:enabled) { |model| model.furniture.enabled }
  attribute(:details_count) { |model| model.furniture.details.size }
end
