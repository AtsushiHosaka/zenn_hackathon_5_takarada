# Validate a browser template without accepting remote model or texture URLs.
class RoomTemplateScene
  class Invalid < StandardError; end

  ID = /\A[a-zA-Z0-9_-]{1,64}\z/
  COLOR = /\A#[0-9a-fA-F]{6}\z/
  WALLS = %w[north east south west].freeze

  def self.call(value)
    new.call(value)
  end

  def call(value)
    invalid! unless value.is_a?(Hash)
    room = value["room"]
    invalid! unless room.is_a?(Hash)
    width = number(room["width"], 1, 25)
    depth = number(room["depth"], 1, 25)
    height = number(room["height"], 1, 8)
    windows = room["windows"]
    objects = value["objects"]
    invalid! unless windows.is_a?(Array) && windows.length <= 20 && objects.is_a?(Array) && objects.length <= 100

    scene = {
      "room" => { "width" => width, "depth" => depth, "height" => height,
                  "wall_color" => color(room["wall_color"]), "floor_color" => color(room["floor_color"]),
                  "windows" => windows.map { |window| window(window, width, depth, height) } },
      "objects" => objects.map { |object| object(object, width, depth, height) }
    }
    invalid! if scene["room"]["windows"].pluck("id").uniq.length != windows.length || scene["objects"].pluck("id").uniq.length != objects.length
    scene
  end

  private

  def window(value, width, depth, room_height)
    invalid! unless value.is_a?(Hash) && WALLS.include?(value["wall"])
    span = %w[north south].include?(value["wall"]) ? width : depth
    window_width = number(value["width"], 0.01, span)
    window_height = number(value["height"], 0.01, room_height)
    center = number(value["center"], 0, span)
    bottom = number(value["bottom"], 0, room_height)
    invalid! if center - window_width / 2 < -0.1 || center + window_width / 2 > span + 0.1 || bottom + window_height > room_height + 0.1
    { "id" => identifier(value["id"]), "wall" => value["wall"], "center" => center,
      "width" => window_width, "height" => window_height, "bottom" => bottom }
  end

  def object(value, width, depth, room_height)
    invalid! unless value.is_a?(Hash) && value["source"] == "existing" && value["model_url"].nil?
    category = value["category"]
    label = value["label"]
    invalid! unless category.is_a?(String) && category.match?(/\A[a-z_]{1,32}\z/) && label.is_a?(String) && label.strip.present? && label.length <= 100
    position = value["position"]
    size = value["size"]
    invalid! unless position.is_a?(Hash) && size.is_a?(Hash)
    w = number(size["w"], 0.001, 25)
    h = number(size["h"], 0.001, room_height)
    d = number(size["d"], 0.001, 25)
    x = number(position["x"], -0.1, width + 0.1)
    y = number(position["y"], -0.1, room_height)
    z = number(position["z"], -0.1, depth + 0.1)
    rotation = number(value["rotation_y"], 0, 359.999999)
    radians = rotation * Math::PI / 180
    rotated_w = Math.cos(radians).abs * w + Math.sin(radians).abs * d
    rotated_d = Math.sin(radians).abs * w + Math.cos(radians).abs * d
    invalid! if x - rotated_w / 2 < -0.1 || x + rotated_w / 2 > width + 0.1 || z - rotated_d / 2 < -0.1 || z + rotated_d / 2 > depth + 0.1 || y + h > room_height + 0.1
    { "id" => identifier(value["id"]), "source" => "existing", "category" => category, "label" => label.strip,
      "position" => { "x" => x, "y" => y, "z" => z }, "size" => { "w" => w, "h" => h, "d" => d },
      "rotation_y" => rotation, "color" => color(value["color"]), "model_url" => nil,
      "slot" => nil, "attach_to" => nil, "item_id" => nil, "marker" => nil }
  end

  def identifier(value)
    invalid! unless value.is_a?(String) && value.match?(ID)
    value
  end

  def color(value)
    invalid! unless value.is_a?(String) && value.match?(COLOR)
    value
  end

  def number(value, minimum, maximum)
    invalid! unless value.is_a?(Numeric) && value.finite? && value.between?(minimum, maximum)
    value.to_f
  end

  def invalid!
    raise Invalid, "テンプレートの部屋・家具・窓の内容を確認してください"
  end
end
