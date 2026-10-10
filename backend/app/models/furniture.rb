# 家具。3D モデル (model) を 1 つ持ち、買える商品 (色・寸法・購入リンク) は details に持つ
class Furniture < ApplicationRecord
  has_one :model, class_name: "Furniture3DModel", dependent: :destroy, inverse_of: :furniture
  # 写真の家具にだけ使う家具は details を持たない
  has_many :details, class_name: "FurnitureDetail", dependent: :restrict_with_exception, inverse_of: :furniture
  scope :available, -> { where(enabled: true) }

  validates :name, :category, presence: true
  validates :enabled, inclusion: { in: [ true, false ] }
end
