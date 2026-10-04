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
  # 置く順番を選ぶときの減点 (ずらした分は距離 m を足す)
  PENALTY = { "other_wall" => 2, "floor" => 4, "dropped" => 10 }.freeze

  # 家具ごとの置き方の記録 (精度の確認用。rooms.analysis に保存する)
  #   result: wall (希望どおり壁沿い) / shifted (同じ壁沿いでずらした) / floor (壁沿いに置けず床へ) /
  #           center (壁に付いていない家具) / dropped (置けなかった) / ignored (対象外の種類)
  attr_reader :log

  def initialize(width:, depth:, height:)
    @width = width
    @depth = depth
    @height = height
    @placed = []
    @log = []
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
    list = Array(list)
    list.reject { |f| CATEGORIES.include?(f["category"]) }.each do |item|
      @log << { "category" => item["category"], "label" => item["label"], "result" => "ignored" }
    end
    # 高さ 30cm 未満の棚は、壁に取り付けた棚を床置きの家具と取り違えたものとして扱わない
    wall_mounted, list = list.partition { |f| f["category"] == "shelf" && f["height_m"].to_f.between?(0.01, 0.3) }
    wall_mounted.each { |item| @log << { "category" => item["category"], "label" => item["label"], "result" => "ignored" } }
    items = list.select { |f| CATEGORIES.include?(f["category"]) }.first(12)
    # id は回答の順に振る (置く順番を変えても同じ家具は同じ id)
    counts = Hash.new(0)
    ids = items.map { |item| "#{item['category']}-#{counts[item['category']] += 1}" }

    # 置く順番で結果が変わる (同じ角を 2 つの家具が取り合うなど) ので、何通りか試して
    # 一番指定どおりに置けた並べ方を採る
    @items_for_order = items
    best = placement_orders(items.each_index.to_a).map { |order| try_order(items, ids, order) }.min_by { |trial| trial[:score] }
    return [] unless best

    @placed.concat(best[:placed])
    @log.concat(best[:log])
    best[:objects]
  end

  # 6 点以下なら全通り、それより多ければ代表的な順番だけ
  def placement_orders(indexes)
    return indexes.permutation.to_a if indexes.size <= 6

    by_area = ->(i) { -size_of_index(i) }
    [
      indexes.sort_by { |i| [ edge?(@items_for_order[i]) ? 0 : 1, by_area.call(i) ] },
      indexes.sort_by { |i| by_area.call(i) },
      indexes.sort_by { |i| [ edge?(@items_for_order[i]) ? 0 : 1, -by_area.call(i) ] }
    ]
  end

  def size_of_index(index)
    size_of(@items_for_order[index]).values_at("w", "d").reduce(:*)
  end

  def try_order(items, ids, order)
    saved_placed = @placed.dup
    saved_log = @log.dup
    @log = []
    placed_by_index = {}
    order.each { |index| placed_by_index[index] = place(items[index], ids[index]) }
    log = @log
    placed = @placed - saved_placed
    { score: log.sum { |entry| PENALTY.fetch(entry["result"], 0) + entry["shift_m"].to_f },
      objects: items.each_index.filter_map { |index| placed_by_index[index] }, placed:, log: }
  ensure
    @placed = saved_placed
    @log = saved_log
  end

  def edge?(item)
    WALLS.include?(item["wall"]) && %w[start end].include?(item["position"])
  end

  def place(item, id)
    size = size_of(item)
    wall = WALLS.include?(item["wall"]) ? item["wall"] : nil
    position, used_wall = wall ? place_on_any_wall(wall, item["position"], size) : nil
    on_wall = !position.nil?
    position ||= place_on_floor(size)
    entry = { "id" => id, "category" => item["category"], "label" => item["label"],
              "requested" => item.slice("wall", "position"), "size" => size }
    unless position
      @log << entry.merge("result" => "dropped")
      return
    end
    @log << entry.merge(placement_result(wall, used_wall, on_wall, item["position"], size, position))

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

  # 指定の壁に入らなければ、隣の壁 (元の壁に近い端)、向かいの壁の順に試す。部屋の中央へ回すのは最後
  def place_on_any_wall(wall, position, size)
    candidates = [ [ wall, position ] ] + adjacent_walls(wall).map { |other| [ other, end_near(other, wall) ] } + [ [ opposite(wall), position ] ]
    candidates.each do |candidate_wall, candidate_position|
      placed = place_on_wall(candidate_wall, candidate_position, size)
      return [ placed, candidate_wall ] if placed
    end
    nil
  end

  def adjacent_walls(wall)
    %w[north south].include?(wall) ? %w[west east] : %w[north south]
  end

  def opposite(wall)
    { "north" => "south", "south" => "north", "east" => "west", "west" => "east" }.fetch(wall)
  end

  # 隣の壁で、元の壁に近い側の端 (start は north/south の壁なら西、east/west の壁なら北)
  def end_near(other, original)
    near_start = %w[north south].include?(other) ? original == "west" : original == "north"
    near_start ? "start" : "end"
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

  def placement_result(wall, used_wall, on_wall, requested_position, size, (x, z, _))
    return { "result" => wall ? "floor" : "center", "placed" => { "x" => x.round(2), "z" => z.round(2) } } unless on_wall
    return { "result" => "other_wall", "wall" => used_wall, "placed" => { "x" => x.round(2), "z" => z.round(2) } } if used_wall != wall

    along = %w[north south].include?(wall) ? x : z
    shift = (along - along_for(requested_position, wall_length(wall), size["w"])).abs.round(2)
    { "result" => shift < 0.05 ? "wall" : "shifted", "shift_m" => shift, "placed" => { "x" => x.round(2), "z" => z.round(2) } }
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
