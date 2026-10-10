# 模様 (質感の画像)。画像本体は GCS の textures/v1/<texture_key>.png
class FurnitureTexture < ApplicationRecord
  OBJECT_KEY_PREFIX = "textures/v1".freeze

  has_many :detail_textures, class_name: "FurnitureDetailTexture", dependent: :restrict_with_exception, inverse_of: :furniture_texture

  validates :texture_key, presence: true, uniqueness: true, format: { with: Furniture3DModel::KEY_PATTERN }
  validates :name, presence: true
  validates :tile_size_m, numericality: { greater_than: 0, less_than_or_equal_to: 10 }
  validates :tinted, inclusion: { in: [ true, false ] }

  # バケット内の画像のパス
  def object_key
    "#{OBJECT_KEY_PREFIX}/#{texture_key}.png"
  end

  # 部位の色と合わせた material_overrides の 1 件。配信元が未設定なら nil
  def material_override(color)
    base = Furniture3DModel.asset_base_url or return
    { "texture_url" => "#{base}/#{object_key}", "tile_size_m" => tile_size_m.to_f, "color" => tinted ? color : "#ffffff" }
  end
end
