# 家具 1 件 = 3D モデル 1 つ。買える商品 (色・寸法・購入リンク) は details に持つ
class Furniture < ApplicationRecord
  UNIT = "meter".freeze
  AXES = "+Y up, +Z front, origin bottom center".freeze
  KEY_PATTERN = /\A[a-zA-Z0-9][a-zA-Z0-9_-]*\z/
  OBJECT_KEY_PREFIX = "models/furniture/v1".freeze

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
  validate :valid_materials

  def self.object_key_for(model_key)
    "#{OBJECT_KEY_PREFIX}/#{model_key}.glb"
  end

  # バケット内の GLB のパス
  def object_key
    self.class.object_key_for(model_key)
  end

  private

  def valid_materials
    errors.add(:materials, "must be an array of strings") unless materials.is_a?(Array) && materials.all? { |material| material.is_a?(String) }
  end
end
