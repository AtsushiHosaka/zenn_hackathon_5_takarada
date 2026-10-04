# 部屋の観察結果 (どの壁沿いに・壁のどのあたりに・どんな家具があるか) から Scene を組み立てる。
# 写真の解析 (Gemini) にもモックにも座標は出させず、座標はここでルールで計算する。
#
# 観察結果の形 (RoomAnalyzer::Gemini::SCHEMA と同じ):
#   wall_color / floor_color: "#rrggbb"
#   windows:   [{ wall: north|south|east|west, position: start|center|end, size: small|medium|large }]
#   furniture: [{ category:, label:, color:, wall: north|south|east|west|none, position: start|center|end,
#                 width_m:, depth_m:, height_m: }]
# position は壁の端からの位置。start は north/south の壁なら西 (x=0) 側、east/west の壁なら北 (z=0) 側。
# 座標系は RoomAnalyzer を参照。
class RoomLayout
  CATEGORIES = %w[bed desk shelf chair sofa table tv_stand storage wardrobe].freeze

  # カテゴリごとの標準寸法 (メートル) と、写真から読んだ寸法を丸める範囲 [最小, 最大]
  SIZES = {
    # 頭を壁に付ける置き方 (幅 < 奥行き) と、長い辺を壁に沿わせる置き方 (幅 > 奥行き) の両方がある
    "bed" => { default: [ 0.97, 0.45, 1.95 ], range: [ [ 0.8, 2.2 ], [ 0.2, 0.7 ], [ 0.8, 2.2 ] ] },
    "desk" => { default: [ 1.0, 0.72, 0.5 ], range: [ [ 0.6, 1.8 ], [ 0.6, 0.8 ], [ 0.4, 0.9 ] ] },
    "shelf" => { default: [ 0.8, 1.8, 0.3 ], range: [ [ 0.3, 1.8 ], [ 0.4, 2.2 ], [ 0.2, 0.5 ] ] },
    "chair" => { default: [ 0.5, 0.85, 0.5 ], range: [ [ 0.4, 0.8 ], [ 0.6, 1.2 ], [ 0.4, 0.8 ] ] },
    "sofa" => { default: [ 1.6, 0.8, 0.85 ], range: [ [ 0.8, 2.4 ], [ 0.6, 1.0 ], [ 0.7, 1.0 ] ] },
    "table" => { default: [ 0.8, 0.4, 0.6 ], range: [ [ 0.4, 1.6 ], [ 0.3, 0.8 ], [ 0.4, 1.0 ] ] },
    "tv_stand" => { default: [ 1.2, 0.45, 0.4 ], range: [ [ 0.6, 2.0 ], [ 0.3, 0.7 ], [ 0.3, 0.5 ] ] },
    "storage" => { default: [ 0.6, 0.9, 0.45 ], range: [ [ 0.3, 1.5 ], [ 0.3, 1.5 ], [ 0.3, 0.6 ] ] },
    "wardrobe" => { default: [ 1.0, 1.8, 0.6 ], range: [ [ 0.6, 2.0 ], [ 1.4, 2.2 ], [ 0.4, 0.7 ] ] }
  }.freeze

  LABELS = {
    "bed" => "ベッド", "desk" => "デスク", "shelf" => "本棚", "chair" => "椅子", "sofa" => "ソファ",
    "table" => "テーブル", "tv_stand" => "テレビ台", "storage" => "収納", "wardrobe" => "ワードローブ"
  }.freeze

  WINDOW_SIZES = {
    "small" => { "width" => 0.8, "bottom" => 1.0, "height" => 0.9 },
    "medium" => { "width" => 1.2, "bottom" => 0.9, "height" => 1.1 },
    # 掃き出し窓
    "large" => { "width" => 1.7, "bottom" => 0.1, "height" => 1.9 }
  }.freeze

  # 壁を背にしたときの向き (正面が部屋の内側を向く)
  ROTATIONS = { "north" => 0, "west" => 90, "south" => 180, "east" => 270 }.freeze
  WALLS = ROTATIONS.keys.freeze
  MARGIN = 0.02
  STEP = 0.05

  def initialize(width:, depth:, height:)
    @width = width
    @depth = depth
    @height = height
    @placed = []
  end

  def build(observation)
    {
      "room" => {
        "width" => @width,
        "depth" => @depth,
        "height" => @height,
        "wall_color" => hex(observation["wall_color"], "#f4f1ec"),
        "floor_color" => hex(observation["floor_color"], "#c8a97e"),
        "windows" => windows(observation["windows"])
      },
      "objects" => furniture(observation["furniture"])
    }
  end

  private

  def windows(list)
    Array(list).select { |w| WALLS.include?(w["wall"]) }.first(4).map.with_index(1) do |window, index|
      size = WINDOW_SIZES.fetch(window["size"], WINDOW_SIZES["medium"])
      length = wall_length(window["wall"])
      width = [ size["width"], length - 0.2 ].min
      center = along_for(window["position"], length, width)
      { "id" => "window-#{index}", "wall" => window["wall"], "center" => center.round(2) }.merge(size).merge("width" => width)
    end
  end

  def furniture(list)
    items = Array(list).select { |f| CATEGORIES.include?(f["category"]) }.first(12)
    counts = Hash.new(0)
    # 大きい家具から置く (後から置くものほど空いた場所へずらされる)
    items.sort_by { |f| -size_of(f).values_at("w", "d").reduce(:*) }.filter_map do |item|
      counts[item["category"]] += 1
      place(item, "#{item['category']}-#{counts[item['category']]}")
    end
  end

  def place(item, id)
    size = size_of(item)
    wall = WALLS.include?(item["wall"]) ? item["wall"] : nil
    position = wall ? place_on_wall(wall, item["position"], size) : nil
    position ||= place_on_floor(size)
    return unless position

    x, z, rotation = position
    footprint = rect(x, z, size, rotation)
    @placed << footprint
    {
      "id" => id,
      "source" => "existing",
      "category" => item["category"],
      "label" => item["label"].presence&.truncate(20) || LABELS.fetch(item["category"]),
      "size" => size,
      "position" => { "x" => x.round(3), "y" => 0.0, "z" => z.round(3) },
      "rotation_y" => rotation,
      "color" => hex(item["color"], "#b8a58c"),
      "model_url" => nil,
      "slot" => nil,
      "attach_to" => nil,
      "item_id" => nil,
      "marker" => nil
    }
  end

  # 壁を背にして置く。希望の位置が埋まっていれば、同じ壁に沿って近い空きへずらす
  def place_on_wall(wall, position, size)
    rotation = ROTATIONS.fetch(wall)
    span = size["w"] # 壁に沿った長さ (背を壁に付けるので幅が壁沿いになる)
    length = wall_length(wall)
    return if span > length - MARGIN * 2

    preferred = along_for(position, length, span)
    candidates = (0..((length - span) / STEP)).map { |i| span / 2 + MARGIN + i * STEP }.select { |c| c + span / 2 <= length - MARGIN }
    candidates.sort_by { |c| (c - preferred).abs }.each do |along|
      x, z = wall_point(wall, along, size["d"] / 2 + MARGIN)
      return [ x, z, rotation ] if free?(rect(x, z, size, rotation))
    end
    nil
  end

  # 壁沿いに置けなければ、部屋の中央に近い空いた床に置く
  def place_on_floor(size)
    xs = (0..((@width - size["w"]) / STEP)).map { |i| size["w"] / 2 + MARGIN + i * STEP }.select { |x| x + size["w"] / 2 <= @width - MARGIN }
    zs = (0..((@depth - size["d"]) / STEP)).map { |i| size["d"] / 2 + MARGIN + i * STEP }.select { |z| z + size["d"] / 2 <= @depth - MARGIN }
    spot = xs.product(zs).select { |x, z| free?(rect(x, z, size, 0)) }
             .min_by { |x, z| Math.hypot(x - @width / 2, z - @depth / 2) }
    spot && [ *spot, 0 ]
  end

  def along_for(position, length, span)
    case position
    when "start" then span / 2 + MARGIN
    when "end" then length - span / 2 - MARGIN
    else length / 2
    end
  end

  def wall_point(wall, along, offset)
    case wall
    when "north" then [ along, offset ]
    when "south" then [ along, @depth - offset ]
    when "west" then [ offset, along ]
    when "east" then [ @width - offset, along ]
    end
  end

  def wall_length(wall)
    %w[north south].include?(wall) ? @width : @depth
  end

  def rect(x, z, size, rotation)
    fw, fd = (rotation % 180).zero? ? [ size["w"], size["d"] ] : [ size["d"], size["w"] ]
    [ x - fw / 2, z - fd / 2, x + fw / 2, z + fd / 2 ]
  end

  def free?(rect)
    @placed.none? { |o| rect[0] < o[2] && rect[2] > o[0] && rect[1] < o[3] && rect[3] > o[1] }
  end

  # 写真から読んだ寸法をカテゴリの範囲に丸める。読めなければ標準寸法
  def size_of(item)
    spec = SIZES.fetch(item["category"])
    values = %w[width_m height_m depth_m].zip(spec[:default], spec[:range]).map do |key, default, (min, max)|
      value = item[key].to_f
      (value.positive? ? value.clamp(min, max) : default).round(2)
    end
    %w[w h d].zip(values).to_h
  end

  def hex(value, fallback)
    value.to_s.match?(/\A#\h{6}\z/) ? value.downcase : fallback
  end
end
