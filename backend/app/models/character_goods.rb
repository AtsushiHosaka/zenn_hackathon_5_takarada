# キャラクターとグッズ (家具) の対応。造形を認めないフランチャイズのキャラクターには作らない
class CharacterGoods < ApplicationRecord
  self.table_name = "character_goods"

  belongs_to :character, inverse_of: :character_goods
  belongs_to :furniture, inverse_of: :character_goods

  validates :furniture_id, uniqueness: { scope: :character_id }
  validate :likeness_allowed

  private

  def likeness_allowed
    errors.add(:character, "belongs to a franchise that does not allow character likenesses") unless character&.franchise&.likeness_allowed?
  end
end
