# コーデ提案。要望と予算から商品を選び、配置後のシーンを after_scene に持つ
class Coordination < ApplicationRecord
  STATUSES = %w[pending processing done failed].freeze
  FLOOR_CATEGORIES = %w[sofa bed desk chair shelf table].freeze
  IMAGE_GOODS_CATEGORIES = %w[poster acrylic_stand].freeze
  MANUAL_CATEGORIES = (FLOOR_CATEGORIES + IMAGE_GOODS_CATEGORIES).freeze
  MANUAL_OBJECT_ID = /\Amanual-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i

  belongs_to :room
  # 追加の指示 (チャット) で作り直すときの前回のコーデ
  belongs_to :base_coordination, class_name: "Coordination", optional: true

  validates :prompt, presence: true, length: { maximum: 500 }
  validates :budget, numericality: { only_integer: true, greater_than: 0 }
  validates :status, inclusion: { in: STATUSES }
  validate :valid_furniture_input
  validate :valid_operations, on: :create
  validate :valid_base_coordination

  # 写真で見つからなかった所有家具も、今回の提案の元の部屋に含める。
  def input_scene
    scene = room.scene.deep_dup
    scene["objects"] += manual_objects
    scene
  end

  private

  def manual_objects
    return [] unless edited_objects.is_a?(Array) && edited_objects.size <= 100

    edited_objects.filter_map do |edit|
      next unless edit.is_a?(Hash) && edit["id"].is_a?(String) && edit["id"].match?(MANUAL_OBJECT_ID)
      product_id = edit["ec_product_id"]
      product = EcProduct.find_by(id: product_id) if product_id.is_a?(Integer) && product_id.positive?
      next if product_id && (!product || !FLOOR_CATEGORIES.include?(product.data["category"]))
      next unless product || (MANUAL_CATEGORIES.include?(edit["category"]) && edit["label"].is_a?(String) && edit["label"].strip.present? && edit["label"].length <= 100)

      next if IMAGE_GOODS_CATEGORIES.include?(edit["category"]) && !ImageArtwork.valid?(edit["artwork"])
      next if edit["artwork"] && !IMAGE_GOODS_CATEGORIES.include?(edit["category"])

      trusted = product ? FurnitureImport.scene_attributes(product).compact.merge(edit.slice("position", "size", "rotation_y", "color")) : edit.slice("label", "category", "position", "size", "rotation_y", "color", "artwork")
      trusted.merge(
        "id" => edit["id"],
        "source" => "existing", "slot" => nil, "attach_to" => nil, "item_id" => nil, "marker" => nil, "model_url" => trusted["model_url"]
      )
    end
  end

  def existing_objects
    (room&.scene&.fetch("objects", [])&.select { |object| object["source"] == "existing" } || []) + manual_objects
  end

  def valid_operations
    existing = existing_objects
    if furniture_operations != []
      valid = furniture_operations.is_a?(Array) && furniture_operations.size <= 100 &&
        furniture_operations.all? { |operation| operation.is_a?(Hash) && operation["object_id"].is_a?(String) && %w[keep replace remove].include?(operation["action"]) }
      if valid
        ids = furniture_operations.pluck("object_id")
        valid = ids.uniq == ids && ids.sort == existing.pluck("id").sort
        valid &&= furniture_operations.all? do |operation|
          operation["action"] != "replace" || FLOOR_CATEGORIES.include?(existing.find { |object| object["id"] == operation["object_id"] }&.fetch("category", nil))
        end
        keep_ids = furniture_operations.select { |operation| operation["action"] == "keep" }.pluck("object_id")
        valid &&= kept_object_ids == [] || (kept_object_ids.is_a?(Array) && kept_object_ids.sort == keep_ids.sort)
      end
      errors.add(:furniture_operations, "既存家具ごとに残す・入れ替える・外すを一つ指定してください") unless valid
    end
    unless additions.is_a?(Array) && additions.size <= 6 && additions.all? { |addition| addition.is_a?(Hash) && FLOOR_CATEGORIES.include?(addition["category"]) }
      errors.add(:additions, "追加する家具は対応カテゴリから6点以内で選んでください")
    end
  end

  # 前回のコーデは、同じ部屋の、生成が終わったものだけ
  def valid_base_coordination
    return if base_coordination_id.nil?
    return if base_coordination && base_coordination.room_id == room_id && base_coordination.status == "done"

    errors.add(:base_coordination_id, "前回のコーデが正しくありません")
  end

  def valid_furniture_input
    existing = existing_objects
    existing_ids = existing.pluck("id")
    unless kept_object_ids.is_a?(Array) && kept_object_ids.uniq == kept_object_ids && (kept_object_ids - existing_ids).empty?
      errors.add(:kept_object_ids, "活かす家具の選択が正しくありません")
    end
    return if edited_objects == []

    unless edited_objects.is_a?(Array) && edited_objects.size <= 100 && edited_objects.all? { |edit| edit.is_a?(Hash) }
      errors.add(:edited_objects, "家具の編集内容が正しくありません")
      return
    end

    artwork_valid = edited_objects.all? do |edit|
      edit["artwork"].nil? || (edit["id"].is_a?(String) && edit["id"].match?(MANUAL_OBJECT_ID) &&
        IMAGE_GOODS_CATEGORIES.include?(edit["category"]) && ImageArtwork.valid?(edit["artwork"]))
    end
    unless artwork_valid
      errors.add(:edited_objects, "推しグッズには最大512pxのPNG画像を指定してください")
      return
    end
    if edited_objects.sum { |edit| edit.dig("artwork", "data_url").to_s.bytesize } > 2 * 1024 * 1024
      errors.add(:edited_objects, "推しグッズの画像は合計2MB以内にしてください")
      return
    end

    suggested_objects = room.coordinations.where(status: "done").pluck(:after_scene).flat_map do |scene|
      (scene&.fetch("objects", []) || []).select { |object| object["source"] == "suggested" }
    end
    suggested_ids = suggested_objects.pluck("id")
    objects_by_id = (existing + suggested_objects).index_by { |object| object["id"] }
    ids = edited_objects.pluck("id")
    linked_ids_valid = edited_objects.all? { |edit| edit["ec_product_id"].nil? || (edit["id"].is_a?(String) && edit["id"].match?(MANUAL_OBJECT_ID) && objects_by_id[edit["id"]]&.fetch("ec_product_id", nil) == edit["ec_product_id"]) }
    unless ids.uniq == ids && linked_ids_valid && (ids - existing_ids - suggested_ids).empty? && edited_objects.all? { |edit| valid_edit?(edit, objects_by_id.fetch(edit["id"])) }
      errors.add(:edited_objects, "家具の編集内容が正しくありません")
    end
  end

  def valid_edit?(edit, original)
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
    inside = position["x"] >= width / 2 - tolerance && position["x"] <= geometry["width"] - width / 2 + tolerance &&
      position["z"] >= depth / 2 - tolerance && position["z"] <= geometry["depth"] - depth / 2 + tolerance &&
      position["y"] >= -tolerance && position["y"] + size["h"] <= geometry["height"] + tolerance
    return false unless inside
    return true if original["slot"] == "rug"

    footprint = [ position["x"] - width / 2, position["z"] - depth / 2,
                  position["x"] + width / 2, position["z"] + depth / 2 ]
    originally_on_floor = original.dig("position", "y").to_f <= 0.05 && !%w[rug curtain wall_decor].include?(original["slot"])
    Array(geometry["doors"]).none? do |door|
      # 床置きの家具・商品は少し浮かせても通り道を空ける。机やベッドの上の小物は床に投影しない。
      floor_blocked = (position["y"] <= 0.05 || originally_on_floor) && position["y"] < door["height"] - tolerance &&
        rectangles_overlap?(footprint, door_rect(door, geometry, RoomLayout::DOOR_CLEARANCE))
      # 短いカーテン・壁飾りも、ドアの開口と高さが重なる配置にはできない。
      opening_blocked = %w[curtain wall_decor].include?(original["slot"]) &&
        position["y"] < door["height"] - tolerance && position["y"] + size["h"] > tolerance &&
        rectangles_overlap?(footprint, door_rect(door, geometry, 0.15))
      floor_blocked || opening_blocked
    end
  end

  def door_rect(door, geometry, reach)
    left = door["center"] - door["width"] / 2
    right = door["center"] + door["width"] / 2
    case door["wall"]
    when "north" then [ left, 0, right, reach ]
    when "south" then [ left, geometry["depth"] - reach, right, geometry["depth"] ]
    when "west" then [ 0, left, reach, right ]
    when "east" then [ geometry["width"] - reach, left, geometry["width"], right ]
    end
  end

  def rectangles_overlap?(first, second)
    [ first[2], second[2] ].min - [ first[0], second[0] ].max > 0.001 &&
      [ first[3], second[3] ].min - [ first[1], second[1] ].max > 0.001
  end

  def finite_number?(value)
    value.is_a?(Numeric) && value.finite?
  end
end
