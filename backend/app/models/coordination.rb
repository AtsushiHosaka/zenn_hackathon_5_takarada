# コーデ提案。要望と予算から商品を選び、配置後のシーンを after_scene に持つ
class Coordination < ApplicationRecord
  STATUSES = %w[pending processing done failed].freeze

  belongs_to :room

  validates :prompt, presence: true, length: { maximum: 500 }
  validates :budget, numericality: { only_integer: true, greater_than: 0 }
  validates :status, inclusion: { in: STATUSES }
  validate :valid_furniture_input

  private

  def valid_furniture_input
    existing_ids = room&.scene&.fetch("objects", [])&.select { |object| object["source"] == "existing" }&.pluck("id") || []
    unless kept_object_ids.is_a?(Array) && kept_object_ids.uniq == kept_object_ids && (kept_object_ids - existing_ids).empty?
      errors.add(:kept_object_ids, "活かす家具の選択が正しくありません")
    end
    return if edited_objects == []

    unless edited_objects.is_a?(Array) && edited_objects.size <= 100 && edited_objects.all? { |edit| edit.is_a?(Hash) }
      errors.add(:edited_objects, "家具の編集内容が正しくありません")
      return
    end

    suggested_ids = room.coordinations.where(status: "done").pluck(:after_scene).flat_map do |scene|
      (scene&.fetch("objects", []) || []).select { |object| object["source"] == "suggested" }.pluck("id")
    end
    ids = edited_objects.pluck("id")
    unless ids.uniq == ids && (ids - existing_ids - suggested_ids).empty? && edited_objects.all? { |edit| valid_edit?(edit) }
      errors.add(:edited_objects, "家具の編集内容が正しくありません")
    end
  end

  def valid_edit?(edit)
    position = edit["position"]
    size = edit["size"]
    rotation = edit["rotation_y"]
    return false unless position.is_a?(Hash) && size.is_a?(Hash)
    return false unless %w[x y z].all? { |key| finite_number?(position[key]) }
    return false unless %w[w h d].all? { |key| finite_number?(size[key]) && size[key].positive? }
    return false unless finite_number?(rotation) && rotation >= 0 && rotation < 360
    return false unless edit["color"].is_a?(String) && edit["color"].match?(/\A#[0-9a-f]{6}\z/i)

    geometry = room.scene.fetch("room")
    angle = rotation * Math::PI / 180
    width = size["w"] * Math.cos(angle).abs + size["d"] * Math.sin(angle).abs
    depth = size["w"] * Math.sin(angle).abs + size["d"] * Math.cos(angle).abs
    tolerance = 0.001
    position["x"] >= width / 2 - tolerance && position["x"] <= geometry["width"] - width / 2 + tolerance &&
      position["z"] >= depth / 2 - tolerance && position["z"] <= geometry["depth"] - depth / 2 + tolerance &&
      position["y"] >= -tolerance && position["y"] + size["h"] <= geometry["height"] + tolerance
  end

  def finite_number?(value)
    value.is_a?(Numeric) && value.finite?
  end
end
