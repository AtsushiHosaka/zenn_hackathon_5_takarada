# キャラクター。グッズ (家具) とは character_goods でつながる
class Character < ApplicationRecord
  belongs_to :franchise, inverse_of: :characters
  has_many :character_goods, class_name: "CharacterGoods", dependent: :restrict_with_exception, inverse_of: :character
  has_many :furnitures, through: :character_goods

  validates :character_key, presence: true, uniqueness: true, format: { with: Furniture3DModel::KEY_PATTERN }
  validates :name, :status, presence: true
  validates :color, format: { with: /\A#[0-9a-f]{6}\z/i }, allow_nil: true
  validate :valid_aliases

  private

  def valid_aliases
    valid = aliases.is_a?(Array) && aliases.all? { |item| item.is_a?(Hash) && item["text"].is_a?(String) && item["text"].present? && [ true, false ].include?(item["ambiguous"]) }
    errors.add(:aliases, "must be [{text, ambiguous}]") unless valid
  end
end
