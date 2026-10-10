# 管理画面用の商品 (furniture_details) の表現。非表示・並び順・編集時刻も出す
class AdminFurnitureDetailSerializer
  include Alba::Resource

  attributes :id, :key, :name, :category, :slot, :symbolic_color, :color_materials, :color_name,
             :size, :price, :shop, :url, :image_url, :themes, :position, :enabled
  attribute(:model_key) { |detail| detail.furniture.model&.model_key }
  attribute(:texture_materials) { |detail| detail.detail_textures.to_h { |texture| [ texture.material_key, texture.furniture_texture.texture_key ] } }
  attribute(:admin_edited_at) { |detail| detail.admin_edited_at&.iso8601 }
  attribute(:checked_at) { |detail| detail.checked_at&.iso8601 }
end
