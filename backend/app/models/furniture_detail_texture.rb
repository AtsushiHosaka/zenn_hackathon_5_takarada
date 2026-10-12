# detail の部位に貼る模様
class FurnitureDetailTexture < ApplicationRecord
  belongs_to :furniture_detail, inverse_of: :detail_textures
  belongs_to :furniture_texture, inverse_of: :detail_textures

  validates :material_key, presence: true, uniqueness: { scope: :furniture_detail_id }
  validate :material_key_in_furniture

  private

  def material_key_in_furniture
    keys = Array(furniture_detail&.furniture&.model&.color_material_keys)
    errors.add(:material_key, "is not a part of the furniture: #{material_key}") unless keys.include?(material_key)
  end
end
