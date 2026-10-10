# 作品・事務所。キャラクターの 3D モデルを作ってよいか (likeness_allowed) と、表示するクレジットを持つ
class Franchise < ApplicationRecord
  has_many :characters, dependent: :restrict_with_exception, inverse_of: :franchise

  validates :franchise_key, presence: true, uniqueness: true, format: { with: Furniture3DModel::KEY_PATTERN }
  validates :name, presence: true
  validates :likeness_allowed, inclusion: { in: [ true, false ] }

  # モデルの近くに表示する権利表記
  def credit_attributes
    { "franchise" => franchise_key, "credit" => credit, "notice" => notice, "license_url" => license_url }
  end
end
