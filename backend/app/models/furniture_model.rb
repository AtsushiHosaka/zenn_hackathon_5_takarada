class FurnitureModel < ApplicationRecord
  UNIT = "meter".freeze
  AXES = "+Y up, +Z front, origin bottom center".freeze
  KEY_PATTERN = /\A[a-zA-Z0-9][a-zA-Z0-9_-]*\z/

  has_many :bindings, class_name: "FurnitureModelBinding", dependent: :destroy
  scope :available, -> { where(enabled: true) }

  validates :key, presence: true, uniqueness: true, format: { with: KEY_PATTERN }
  validates :name, :category, :shape, :object_key, presence: true
  validates :format, inclusion: { in: %w[glb] }
  validates :width, :height, :depth, numericality: { greater_than: 0, less_than: 10_000 }
  validates :triangle_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :byte_size, numericality: { only_integer: true, greater_than: 0 }
  validates :sha256, format: { with: /\A[0-9a-f]{64}\z/ }
  validates :enabled, inclusion: { in: [ true, false ] }
  validate :valid_object_key
  validate :valid_materials

  def self.valid_object_key?(value)
    value.is_a?(String) && value.end_with?(".glb") &&
      value.split("/", -1).all? { |segment| segment.match?(/\A[a-zA-Z0-9][a-zA-Z0-9._-]*\z/) && !segment.include?("..") }
  end

  private

  def valid_object_key
    errors.add(:object_key, "must be a relative GLB path without traversal") unless self.class.valid_object_key?(object_key)
  end

  def valid_materials
    errors.add(:materials, "must be an array of strings") unless materials.is_a?(Array) && materials.all? { |material| material.is_a?(String) }
  end
end
