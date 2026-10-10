# 家具。3D モデル (model) を 1 つ持ち、買える商品 (色・寸法・購入リンク) は details に持つ
class Furniture < ApplicationRecord
  has_one :model, class_name: "Furniture3DModel", dependent: :destroy, inverse_of: :furniture
  has_many :character_goods, class_name: "CharacterGoods", dependent: :delete_all, inverse_of: :furniture
  has_many :characters, through: :character_goods
  # 写真の家具にだけ使う家具は details を持たない
  has_many :details, class_name: "FurnitureDetail", dependent: :restrict_with_exception, inverse_of: :furniture
  scope :available, -> { where(enabled: true) }
  # キャラクターが付いていない家具 (写真の家具の推測に使う)
  scope :without_characters, -> { where.not(id: CharacterGoods.select(:furniture_id)) }

  validates :name, :category, presence: true
  validates :enabled, inclusion: { in: [ true, false ] }
end
