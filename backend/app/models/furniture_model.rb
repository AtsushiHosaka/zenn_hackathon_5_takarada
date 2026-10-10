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
  validate :valid_character_goods

  def self.valid_object_key?(value)
    value.is_a?(String) && value.end_with?(".glb") &&
      value.split("/", -1).all? { |segment| segment.match?(/\A[a-zA-Z0-9][a-zA-Z0-9._-]*\z/) && !segment.include?("..") }
  end

  # キャラクターのフランチャイズから導くクレジット ([{franchise, credit, notice, license_url}])。
  def credits
    CharacterCatalog.credits(characters)
  end

  private

  def valid_object_key
    errors.add(:object_key, "must be a relative GLB path without traversal") unless self.class.valid_object_key?(object_key)
  end

  def valid_materials
    errors.add(:materials, "must be an array of strings") unless materials.is_a?(Array) && materials.all? { |material| material.is_a?(String) }
  end

  def valid_character_goods
    errors.add(:goods_type, "must be a goods type in config/characters.json") unless goods_type.nil? || CharacterCatalog.goods_type(goods_type)
    errors.add(:search_terms, "must be an array of strings") unless string_array?(search_terms)
    return errors.add(:characters, "must be an array of strings") unless string_array?(characters)
    errors.add(:characters, "require a goods_type") if characters.any? && goods_type.nil?

    characters.each do |id|
      if CharacterCatalog.character(id).nil?
        errors.add(:characters, "#{id} is not a character in config/characters.json")
      elsif !CharacterCatalog.likeness_allowed?(id)
        errors.add(:characters, "#{id} belongs to a franchise that does not allow character likenesses")
      end
    end
  end

  def string_array?(value)
    value.is_a?(Array) && value.all? { |item| item.is_a?(String) }
  end
end
