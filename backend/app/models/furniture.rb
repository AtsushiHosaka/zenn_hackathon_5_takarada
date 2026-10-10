# 家具 1 件 = 3D モデル 1 つ。買える商品 (色・寸法・購入リンク) は details に持つ
class Furniture < ApplicationRecord
  UNIT = "meter".freeze
  AXES = "+Y up, +Z front, origin bottom center".freeze
  KEY_PATTERN = /\A[a-zA-Z0-9][a-zA-Z0-9_-]*\z/
  OBJECT_KEY_PREFIX = "models/furniture/v1".freeze
  # 代表色を取る部位。形で決まるもの以外は、この順で最初に持っている部位
  PRIMARY_COLOR_KEYS = %w[tint wood fabric fabric_base rattan weave leaf pot metal].freeze
  SHAPE_PRIMARY_COLOR_KEYS = { "hanger_rack" => "metal", "floor_lamp_slim" => "light",
                               "led_strip_segment" => "light", "fairy_lights" => "light", "neon_sign" => "light" }.freeze

  has_many :bindings, class_name: "FurnitureBinding", dependent: :destroy, inverse_of: :furniture
  # 写真の家具にだけ使うモデルは details を持たない
  has_many :details, class_name: "FurnitureDetail", dependent: :restrict_with_exception, inverse_of: :furniture
  scope :available, -> { where(enabled: true) }

  validates :model_key, presence: true, uniqueness: true, format: { with: KEY_PATTERN }
  validates :name, :category, :shape, presence: true
  validates :format, inclusion: { in: %w[glb] }
  validates :width, :height, :depth, numericality: { greater_than: 0, less_than: 10_000 }
  validates :triangle_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :byte_size, numericality: { only_integer: true, greater_than: 0 }
  validates :sha256, format: { with: /\A[0-9a-f]{64}\z/ }
  validates :enabled, inclusion: { in: [ true, false ] }
  validate :valid_color_material_keys

  def self.object_key_for(model_key)
    "#{OBJECT_KEY_PREFIX}/#{model_key}.glb"
  end

  # バケット内の GLB のパス
  def object_key
    self.class.object_key_for(model_key)
  end

  # 主な部位。画面で色を変えた家具はこの部位を塗り替える
  def primary_color_key
    key = SHAPE_PRIMARY_COLOR_KEYS[shape]
    return key if color_material_keys.include?(key)

    PRIMARY_COLOR_KEYS.find { |name| color_material_keys.include?(name) } || color_material_keys.first
  end

  private

  def valid_color_material_keys
    unless color_material_keys.is_a?(Array) && color_material_keys.all? { |key| key.is_a?(String) }
      errors.add(:color_material_keys, "must be an array of strings")
    end
  end
end
