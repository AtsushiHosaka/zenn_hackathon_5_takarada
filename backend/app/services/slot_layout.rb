require "digest"

# 商品を「枠 (slot)」のルールで部屋に配置し、Scene の object を作る。
# AI は「どの枠にどの商品を入れるか」だけを決め、座標はここで計算する (LLM に座標を出させない)。
#
# 座標系は RoomAnalyzer を参照。枠ごとの置き方:
#   bed_cover  : ベッドに掛ける          cushion  : ベッドの枕元
#   curtain    : 窓の前                  rug      : 床 (家具と重なりが少なく中央寄り)
#   wall_decor : デスク (無ければベッド) の上の壁
#   light      : 床の空いた角 (desk_lamp はデスクの上)
#   display    : 本棚 (無ければデスク) の横の床。低いものは本棚の上
#   desk_top   : デスクの上
# 置き場所が無ければ nil を返し、呼び出し側はその商品を採用しない。
class SlotLayout
  Placement = Data.define(:object, :note)

  MARGIN = 0.02
  GRID_STEP = 0.05
  BACK_WALL = { 0 => "north", 90 => "west", 180 => "south", 270 => "east" }.freeze

  def self.object_id_for(item)
    group = item.metadata["group_id"]
    group.present? ? "item-#{item.id}-#{Digest::SHA256.hexdigest(group)[0, 12]}" : "item-#{item.id}"
  end

  def initialize(scene, kept_objects, edited_objects: [], reserved_object_ids: [])
    @room = scene.fetch("room")
    @objects = kept_objects
    @edited_objects = edited_objects.index_by { |edit| edit["id"] }
    @floor_rects = kept_objects.map { |o| footprint(o) } + doors.map { |door| door_floor_rect(door) }
    @wall_spans = Hash.new { |h, k| h[k] = [] }
    @reserved_edit_ids = []
    @reserved_floor_rects = {}
    edited_objects.each { |edit| reserve_edit(edit) if reserved_object_ids.include?(edit["id"]) }
    # 壁に掛けたもの (宙に浮いている) の床の占有と高さ。背の高い床置きのものがぶつからないようにする
    @raised = []
  end

  # 上に小物を置ける家具 (卓上の枠)。背の高い棚・収納の上には置かない
  TOP_ANCHORS = %w[desk table storage tv_stand shelf].freeze
  TOP_MAX_HEIGHT = 1.2
  # 上の壁に飾りを掛ける目安にする家具 (壁際にあるものだけ)
  WALL_ANCHORS = %w[desk bed sofa storage tv_stand shelf table].freeze
  # 横に飾り棚・観葉植物を置く目安にする家具
  SIDE_ANCHORS = %w[shelf desk storage tv_stand sofa].freeze

  # その部屋 (活かす家具と窓) で置き場所がありうる枠。商品選びはこの枠の商品だけを候補にする
  def self.placeable_slots(room, objects)
    categories = objects.map { |object| object["category"] }
    CoordinationPlanner::SLOT_PRIORITY.select do |slot|
      case slot
      when "bed_cover" then categories.include?("bed")
      when "cushion" then (categories & %w[bed sofa]).any?
      when "desk_top" then objects.any? { |object| top_anchor?(object) }
      when "curtain" then Array(room["windows"]).any?
      else true # 壁飾り・ラグ・照明・飾り棚は、家具が無くても空いた壁・床に置ける
      end
    end
  end

  def self.top_anchor?(object)
    TOP_ANCHORS.include?(object["category"]) && object.dig("size", "h").to_f <= TOP_MAX_HEIGHT
  end

  def place(item)
    if (edit = @edited_objects[self.class.object_id_for(item)])
      size = ec_product?(item) ? item.size : edit["size"]
      attachment = nil
      if ec_product?(item) && %w[bed_cover curtain].include?(item.slot)
        validated = item.slot == "bed_cover" ? place_bed_cover(item) : place_curtain(item)
        return unless validated

        size = validated.object["size"]
        attachment = validated.object["attach_to"]
      end
      if item.slot == "floor"
        return unless floor_pose_available?(size, edit["position"], edit["rotation_y"], ignored_rect: @reserved_floor_rects[edit["id"]])
      end
      if ec_product?(item) && @reserved_floor_rects[edit["id"]]
        @floor_rects.delete_if { |rect| rect.equal?(@reserved_floor_rects[edit["id"]]) }
        @reserved_edit_ids.delete(edit["id"])
      end
      reserve_edit(edit.merge("size" => size))
      placement = build(item, size, edit["position"], edit["rotation_y"], attachment, "調整した配置")
      placement.object["color"] = edit["color"]
      return placement
    end

    case item.slot
    when "bed_cover" then place_bed_cover(item)
    when "cushion" then place_cushion(item)
    when "curtain" then place_curtain(item)
    when "rug" then place_rug(item)
    when "wall_decor" then place_wall_decor(item)
    when "light" then item.category == "desk_lamp" ? place_desk_top(item) : place_floor_lamp(item)
    when "display" then place_display(item)
    when "desk_top" then place_desk_top(item)
    when "floor" then place_floor_furniture(item)
    end
  end

  private

  def floor_pose_available?(size, position, rotation, ignored_rect: nil)
    return false if size["h"] > @room["height"] || position["y"].abs > 0.001

    fw, fd = footprint_size(size, rotation)
    x, z = position.values_at("x", "z")
    rect = [ x - fw / 2, z - fd / 2, x + fw / 2, z + fd / 2 ]
    rect[0] >= MARGIN && rect[1] >= MARGIN && rect[2] <= @room["width"] - MARGIN && rect[3] <= @room["depth"] - MARGIN &&
      @floor_rects.none? { |other| !other.equal?(ignored_rect) && overlap_area(rect, other).positive? }
  end

  def place_floor_furniture(item)
    return if item.size["h"] > @room["height"]

    preferred = item.metadata["preferred_position"]
    rotation = item.metadata["preferred_rotation"] || 0
    if preferred && floor_pose_available?(item.size, preferred, rotation)
      x, z = preferred.values_at("x", "z")
    else
      center = preferred || { "x" => @room["width"] / 2, "z" => @room["depth"] / 2 }
      x, z, rotation = best_floor_spot(item.size, [ rotation, (rotation + 90) % 360 ].uniq) do |cx, cz, _|
        Math.hypot(cx - center["x"], cz - center["z"])
      end
    end
    return unless x

    occupy_floor(x, z, item.size, rotation)
    placement = build(item, item.size, { "x" => x, "y" => 0.0, "z" => z }, rotation, nil, preferred ? "元家具の位置を優先し、空き領域に配置" : "床の空き領域に配置")
    placement.object["replaces_object_id"] = item.metadata["replaces_object_id"]
    placement
  end

  def reserve_edit(edit)
    return if @reserved_edit_ids.include?(edit["id"])

    @reserved_edit_ids << edit["id"]
    if edit["position"]["y"] <= 0.05 && edit["slot"] != "rug"
      occupy_floor(edit["position"]["x"], edit["position"]["z"], edit["size"], edit["rotation_y"])
      @reserved_floor_rects[edit["id"]] = @floor_rects.last
    elsif edit["slot"] == "wall_decor"
      wall = back_wall(edit["rotation_y"])
      along = along_of(edit, wall)
      @wall_spans[wall] << [ along - edit["size"]["w"] / 2, along + edit["size"]["w"] / 2,
                            edit["position"]["y"], edit["position"]["y"] + edit["size"]["h"] ]
    end
  end

  def find(category)
    @objects.find { |o| o["category"] == category }
  end

  # --- 家具に付ける枠 ---

  def place_bed_cover(item)
    bed = find("bed") or return
    if ec_product?(item)
      size = preview_render_size(item, %w[w d]) or return
      return if size["w"] < bed["size"]["w"] || size["d"] < bed["size"]["d"]

      fw, fd = footprint_size(size, bed["rotation_y"])
      return if fw > @room["width"] || fd > @room["depth"]
    else
      size = { "w" => bed["size"]["w"] + 0.08, "h" => 0.06, "d" => bed["size"]["d"] + 0.04 }
    end
    position = clamp_inside(bed["position"].merge("y" => bed["size"]["h"] - 0.02), size, bed["rotation_y"])
    if ec_product?(item)
      angle = bed["rotation_y"] * Math::PI / 180
      dx, dz = position["x"] - bed["position"]["x"], position["z"] - bed["position"]["z"]
      local_x, local_z = dx * Math.cos(angle) - dz * Math.sin(angle), dx * Math.sin(angle) + dz * Math.cos(angle)
      return if local_x.abs > (size["w"] - bed["size"]["w"]) / 2 + 1e-6 || local_z.abs > (size["d"] - bed["size"]["d"]) / 2 + 1e-6
    end
    build(item, size, position, bed["rotation_y"], bed["id"], "ベッドに掛ける")
  end

  # ベッドの枕元。ベッドが無ければソファの座面の奥
  def place_cushion(item)
    if (bed = find("bed"))
      x, z = local_to_world(bed, 0, -(bed["size"]["d"] / 2 - 0.3))
      position = { "x" => x, "y" => bed["size"]["h"] + 0.04, "z" => z }
      return build(item, item.size, position, bed["rotation_y"], bed["id"], "ベッドの枕元")
    end

    sofa = find("sofa") or return
    x, z = local_to_world(sofa, 0, -(sofa["size"]["d"] / 2 - item.size["d"] / 2 - 0.12))
    # 座面はソファの高さのおよそ半分
    position = { "x" => x, "y" => sofa["size"]["h"] * 0.5, "z" => z }
    build(item, item.size, position, sofa["rotation_y"], sofa["id"], "#{sofa['label']}の上")
  end

  # デスクの上。無ければテーブル・低い収納・テレビ台・低い棚の上 (天板に収まるものだけ)
  def place_desk_top(item)
    anchor = TOP_ANCHORS.lazy.filter_map { |category| find(category) if top_anchor_fits?(category, item) }.first or return
    lx = anchor["size"]["w"] / 2 - item.size["w"] / 2 - 0.08
    lz = -(anchor["size"]["d"] / 2 - item.size["d"] / 2 - 0.05)
    x, z = local_to_world(anchor, lx, lz)
    build(item, item.size, { "x" => x, "y" => anchor["size"]["h"], "z" => z }, anchor["rotation_y"], anchor["id"], "#{anchor['label']}の上")
  end

  def top_anchor_fits?(category, item)
    object = find(category)
    object && self.class.top_anchor?(object) &&
      item.size["w"] <= object["size"]["w"] - 0.1 && item.size["d"] <= object["size"]["d"]
  end

  # --- 壁・窓の枠 ---

  def place_curtain(item)
    window = @room["windows"]&.first or return
    return place_ec_curtain(item, window) if ec_product?(item)

    # 窓より左右 20cm ずつ広く掛ける。部屋の角に近い窓では、壁からはみ出さないよう縮める
    left = [ window["center"] - window["width"] / 2 - 0.2, MARGIN ].max
    right = [ window["center"] + window["width"] / 2 + 0.2, wall_length(window["wall"]) - MARGIN ].min
    top = [ window["bottom"] + window["height"] + 0.15, @room["height"] - 0.05 ].min
    # 窓の下に家具 (デスクなど) があれば、床まで垂らさず窓の下端の少し下で止める。
    # 掃き出し窓のように窓が床近くまであるときは、家具の天板の上で止める
    under = furniture_on(window["wall"]).select { |l, r, _, _| l < right && r > left }
    bottom = under.any? ? [ window["bottom"] - 0.1, under.map { |_, _, _, t| t + 0.02 }.max ].max : 0.0
    # 床まで垂らすときは、ドアの前 (開け閉めの範囲) にかからないよう、かかる側を切り詰める
    left, right = trim_for_doors(window["wall"], left, right) if bottom.zero?
    return if right - left < 0.3 || bottom >= top
    size = { "w" => right - left, "h" => top - bottom, "d" => item.size["d"] }
    x, z, rotation = wall_pose(window["wall"], (left + right) / 2, size["d"] / 2 + 0.05)
    # 床まで垂らすときは、カーテンの前 (壁から 15cm) に床置きのものを置かない
    occupy_floor(*wall_pose(window["wall"], (left + right) / 2, 0.075).first(2), size.merge("d" => 0.15), rotation) if bottom.zero?
    build(item, size, { "x" => x, "y" => bottom, "z" => z }, rotation, window["id"], "窓")
  end

  def ec_product?(item)
    item.metadata["provider"].present? && item.metadata["source"] != "mock"
  end

  def preview_render_size(item, axes)
    physical = item.metadata["size"].to_h.slice(*axes).select { |_, value| positive_dimension?(value) }
    size = item.size.merge(physical)
    size if %w[w h d].all? { |axis| positive_dimension?(size[axis]) }
  end

  def positive_dimension?(value)
    value.is_a?(Numeric) && value.to_f.finite? && value.positive?
  end

  def place_ec_curtain(item, window)
    size = preview_render_size(item, %w[w h]) or return
    length = wall_length(window["wall"])
    # Published width is a single panel unless the provider explicitly supplies a
    # verified combined width. Do not invent a second panel or compress the fabric.
    return if size["w"] + 2 * MARGIN > length

    left = [ window["center"] - window["width"] / 2 - 0.2, MARGIN ].max
    right = [ window["center"] + window["width"] / 2 + 0.2, length - MARGIN ].min
    top = [ window["bottom"] + window["height"] + 0.15, @room["height"] - 0.05 ].min
    return if top < window["bottom"] + window["height"]

    along = window["center"].clamp(size["w"] / 2 + MARGIN, length - size["w"] / 2 - MARGIN)
    actual_left = along - size["w"] / 2
    actual_right = along + size["w"] / 2
    bottom = top - size["h"]
    required_bottom = [ window["bottom"] - 0.1, 0.0 ].max
    return if actual_left > left || actual_right < right || bottom.negative? || bottom > required_bottom
    return if furniture_on(window["wall"]).any? { |l, r, _, height| l < actual_right && r > actual_left && bottom < height + MARGIN }

    x, z, rotation = wall_pose(window["wall"], along, size["d"] / 2 + 0.05)
    return if doors_on(window["wall"]).any? { |l, r, _, height| actual_left < r && actual_right > l && bottom < height }
    if bottom <= 0.05
      fw, fd = footprint_size(size.merge("d" => 0.15), rotation)
      floor_x, floor_z = wall_pose(window["wall"], along, 0.075).first(2)
      rect = [ floor_x - fw / 2, floor_z - fd / 2, floor_x + fw / 2, floor_z + fd / 2 ]
      return if doors.any? { |door| overlap_area(rect, door_floor_rect(door)).positive? }
    end
    occupy_floor(*wall_pose(window["wall"], along, 0.075).first(2), size.merge("d" => 0.15), rotation) if bottom <= 0.05
    build(item, size, { "x" => x, "y" => bottom, "z" => z }, rotation, window["id"], "商品のプレビュー寸法で窓に配置（枚数・金具は未確認）")
  end

  # 家具 (デスク・ベッド・ソファ・収納など) の上の壁。どれにも掛けられなければ空いている壁
  def place_wall_decor(item)
    wall_anchors.each do |anchor|
      wall = back_wall(anchor["rotation_y"])
      bottom = [ anchor["size"]["h"] + 0.3, 1.0 ].max
      # 背の高い収納などの上では天井に収まらないので、次の家具か空いている壁にする
      next if bottom + item.size["h"] > @room["height"] - 0.05

      preferred = along_of(anchor, wall)
      along = free_wall_position(wall, preferred, item.size["w"], bottom, bottom + item.size["h"]) or next
      @wall_spans[wall] << [ along - item.size["w"] / 2, along + item.size["w"] / 2, bottom, bottom + item.size["h"] ]
      x, z, rotation = wall_pose(wall, along, item.size["d"] / 2 + 0.01)
      fw, fd = footprint_size(item.size, rotation)
      @raised << [ [ x - fw / 2, z - fd / 2, x + fw / 2, z + fd / 2 ], bottom ]
      # 窓や棚を避けてずらしたときは「上」ではなくなる
      note = (along - preferred).abs < 0.3 ? "#{anchor['label']}の上の壁" : "#{anchor['label']}の近くの壁"
      return build(item, item.size, { "x" => x, "y" => bottom, "z" => z }, rotation, anchor["id"], note)
    end
    place_on_free_wall(item)
  end

  # 壁際にある家具だけを、壁飾りの目安にする (部屋の中央のテーブルなどは除く)
  def wall_anchors
    WALL_ANCHORS.flat_map { |category| @objects.select { |o| o["category"] == category } }.select do |object|
      fw, fd = footprint_size(object["size"], object["rotation_y"])
      wall_gap(back_wall(object["rotation_y"]), object["position"]["x"], object["position"]["z"], fw, fd) <= 0.15
    end
  end

  # 目の高さ (下端 1.2m) で、長い壁の中央から近い空きに掛ける
  def place_on_free_wall(item)
    bottom = 1.2
    top = bottom + item.size["h"]
    walls = %w[north east south west].sort_by { |wall| -wall_length(wall) }
    walls.each do |wall|
      along = free_wall_position(wall, wall_length(wall) / 2, item.size["w"], bottom, top) or next
      @wall_spans[wall] << [ along - item.size["w"] / 2, along + item.size["w"] / 2, bottom, top ]
      x, z, rotation = wall_pose(wall, along, item.size["d"] / 2 + 0.01)
      fw, fd = footprint_size(item.size, rotation)
      @raised << [ [ x - fw / 2, z - fd / 2, x + fw / 2, z + fd / 2 ], bottom ]
      return build(item, item.size, { "x" => x, "y" => bottom, "z" => z }, rotation, nil, "空いている壁")
    end
    nil
  end

  # 窓や他の壁飾りと重ならない位置を、希望位置から近い順に探す
  def free_wall_position(wall, preferred, width, bottom, top)
    length = %w[north south].include?(wall) ? @room["width"] : @room["depth"]
    blocked = @wall_spans[wall] + windows_on(wall) + furniture_on(wall) + doors_on(wall)
    candidates = (0..(length / GRID_STEP)).map { |i| i * GRID_STEP }
                                          .select { |c| c - width / 2 >= MARGIN && c + width / 2 <= length - MARGIN }
    candidates.sort_by { |c| (c - preferred).abs }.find do |c|
      blocked.none? { |l, r, b, t| c - width / 2 < r && c + width / 2 > l && bottom < t && top > b }
    end
  end

  # 壁際に置かれた家具が、壁のどの範囲を床から天板の高さまでふさいでいるか
  def furniture_on(wall)
    @objects.filter_map do |object|
      fw, fd = footprint_size(object["size"], object["rotation_y"])
      x = object["position"]["x"]
      z = object["position"]["z"]
      next if wall_gap(wall, x, z, fw, fd) > 0.15

      along, half = %w[north south].include?(wall) ? [ x, fw / 2 ] : [ z, fd / 2 ]
      [ along - half, along + half, 0, object["position"]["y"] + object["size"]["h"] ]
    end
  end

  def wall_length(wall)
    %w[north south].include?(wall) ? @room["width"] : @room["depth"]
  end

  # 壁沿いの範囲 [left, right] (壁から 0.15m まで) が、ドアの前の床にかかる分を切り詰める
  def trim_for_doors(wall, left, right)
    doors.each do |door|
      rect = door_floor_rect(door)
      along = %w[north south].include?(wall) ? [ rect[0], rect[2] ] : [ rect[1], rect[3] ]
      gap = wall_gap(wall, (rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2, rect[2] - rect[0], rect[3] - rect[1])
      next if gap > 0.15 || along[1] <= left || along[0] >= right

      # ドアに近い側を切る
      if (along[0] + along[1]) / 2 < (left + right) / 2
        left = [ left, along[1] ].max
      else
        right = [ right, along[0] ].min
      end
    end
    [ left, right ]
  end

  # ドア (RoomLayout が room["doors"] に入れる)。古いシーンには無い
  def doors
    Array(@room["doors"])
  end

  # 壁のうちドアがある範囲 (床からドアの高さまで)
  def doors_on(wall)
    doors.select { |d| d["wall"] == wall }.map do |d|
      [ d["center"] - d["width"] / 2, d["center"] + d["width"] / 2, 0, d["height"] ]
    end
  end

  # ドアの前の床 (開け閉めと通り道)。ラグ以外の床置きの商品を置かない
  def door_floor_rect(door)
    left = door["center"] - door["width"] / 2
    right = door["center"] + door["width"] / 2
    reach = RoomLayout::DOOR_CLEARANCE
    case door["wall"]
    when "north" then [ left, 0, right, reach ]
    when "south" then [ left, @room["depth"] - reach, right, @room["depth"] ]
    when "west" then [ 0, left, reach, right ]
    when "east" then [ @room["width"] - reach, left, @room["width"], right ]
    end
  end

  def windows_on(wall)
    (@room["windows"] || []).select { |w| w["wall"] == wall }.map do |w|
      [ w["center"] - w["width"] / 2 - 0.25, w["center"] + w["width"] / 2 + 0.25, w["bottom"], w["bottom"] + w["height"] ]
    end
  end

  # --- 床の枠 ---

  def place_rug(item)
    center = [ @room["width"] / 2, @room["depth"] / 2 ]
    x, z, rotation = best_floor_spot(item.size, [ 0, 90 ], allow_overlap: true) do |cx, cz, overlap|
      overlap * 20 + Math.hypot(cx - center[0], cz - center[1])
    end
    return unless x

    # ラグは上に物を置けるので床の占有には加えない
    build(item, item.size, { "x" => x, "y" => 0.0, "z" => z }, rotation, nil, "部屋の中央")
  end

  def place_floor_lamp(item)
    corners = [ [ 0, 0 ], [ @room["width"], 0 ], [ 0, @room["depth"] ], [ @room["width"], @room["depth"] ] ]
    x, z, rotation = best_floor_spot(item.size, [ 0 ]) do |cx, cz, _|
      corners.map { |px, pz| Math.hypot(cx - px, cz - pz) }.min
    end
    return unless x

    occupy_floor(x, z, item.size, rotation)
    build(item, item.size, { "x" => x, "y" => 0.0, "z" => z }, rotation, nil, "部屋の角")
  end

  # 本棚・デスク・収納・テレビ台・ソファの横の床。どれも無ければ空いた床の壁際
  def place_display(item)
    anchor = SIDE_ANCHORS.lazy.filter_map { |category| find(category) }.first
    return place_on_floor_by_wall(item) unless anchor

    if item.size["h"] < 0.3 && anchor["category"] == "shelf"
      position = anchor["position"].merge("y" => anchor["size"]["h"])
      return build(item, item.size, position, anchor["rotation_y"], anchor["id"], "本棚の上")
    end

    # 家具の正面をふさがないよう、同じ壁に沿った横を優先する
    ax = anchor["position"]["x"]
    az = anchor["position"]["z"]
    wall = back_wall(anchor["rotation_y"])
    fw, fd = footprint_size(item.size, anchor["rotation_y"])
    x, z, rotation = best_floor_spot(item.size, [ anchor["rotation_y"] ]) do |cx, cz, _|
      Math.hypot(cx - ax, cz - az) + wall_gap(wall, cx, cz, fw, fd) * 3
    end
    return place_on_floor_by_wall(item) unless x

    occupy_floor(x, z, item.size, rotation)
    build(item, item.size, { "x" => x, "y" => 0.0, "z" => z }, rotation, anchor["id"], "#{anchor['label']}の横")
  end

  # 空いた床のうち、壁に一番近いところ (部屋の真ん中をふさがない)
  def place_on_floor_by_wall(item)
    x, z, rotation = best_floor_spot(item.size, [ 0, 90, 180, 270 ]) do |cx, cz, _|
      [ cz, @room["depth"] - cz, cx, @room["width"] - cx ].min
    end
    return unless x

    occupy_floor(x, z, item.size, rotation)
    build(item, item.size, { "x" => x, "y" => 0.0, "z" => z }, rotation, nil, "壁際")
  end

  # 床を格子状に走査し、ブロックの評価値が最小の位置を返す。
  # allow_overlap: false のときは既存の家具と重なる位置を除外する
  def best_floor_spot(size, rotations, allow_overlap: false)
    best = nil
    rotations.each do |rotation|
      fw, fd = footprint_size(size, rotation)
      xs = grid(fw / 2 + MARGIN, @room["width"] - fw / 2 - MARGIN)
      zs = grid(fd / 2 + MARGIN, @room["depth"] - fd / 2 - MARGIN)
      xs.product(zs).each do |cx, cz|
        rect = [ cx - fw / 2, cz - fd / 2, cx + fw / 2, cz + fd / 2 ]
        overlap = @floor_rects.sum { |other| overlap_area(rect, other) }
        next if !allow_overlap && overlap.positive?
        next if @raised.any? { |raised, bottom| size["h"] > bottom && overlap_area(rect, raised).positive? }

        score = yield(cx, cz, overlap)
        best = [ score, cx, cz, rotation ] if best.nil? || score < best[0]
      end
    end
    best&.drop(1)
  end

  def grid(from, to)
    return [] if from > to

    (0..((to - from) / GRID_STEP)).map { |i| from + i * GRID_STEP }
  end

  def occupy_floor(x, z, size, rotation)
    fw, fd = footprint_size(size, rotation)
    @floor_rects << [ x - fw / 2, z - fd / 2, x + fw / 2, z + fd / 2 ]
  end

  # --- 幾何 ---

  def footprint(object)
    x = object["position"]["x"]
    z = object["position"]["z"]
    fw, fd = footprint_size(object["size"], object["rotation_y"])
    [ x - fw / 2 - MARGIN, z - fd / 2 - MARGIN, x + fw / 2 + MARGIN, z + fd / 2 + MARGIN ]
  end

  # 壁際の家具より大きいもの (カバー) が壁にめり込まないよう、部屋の内側へずらす
  def clamp_inside(position, size, rotation)
    fw, fd = footprint_size(size, rotation)
    x = position["x"].clamp(fw / 2, @room["width"] - fw / 2)
    z = position["z"].clamp(fd / 2, @room["depth"] - fd / 2)
    position.merge("x" => x, "z" => z)
  end

  def footprint_size(size, rotation)
    angle = rotation * Math::PI / 180
    [ size["w"] * Math.cos(angle).abs + size["d"] * Math.sin(angle).abs,
      size["w"] * Math.sin(angle).abs + size["d"] * Math.cos(angle).abs ]
  end

  def back_wall(rotation)
    BACK_WALL.fetch((rotation / 90.0).round * 90 % 360)
  end

  def overlap_area(a, b)
    w = [ a[2], b[2] ].min - [ a[0], b[0] ].max
    d = [ a[3], b[3] ].min - [ a[1], b[1] ].max
    w.positive? && d.positive? ? w * d : 0
  end

  # 物体のローカル座標 (lx, lz) をワールド座標に変換する (three.js の rotation.y と同じ回転)
  def local_to_world(object, lx, lz)
    theta = object["rotation_y"] * Math::PI / 180
    x = object["position"]["x"] + lx * Math.cos(theta) + lz * Math.sin(theta)
    z = object["position"]["z"] - lx * Math.sin(theta) + lz * Math.cos(theta)
    [ x, z ]
  end

  # 床に置いた物体 (中心 cx, cz / 床の占有 fw × fd) と壁の隙間
  def wall_gap(wall, cx, cz, fw, fd)
    case wall
    when "north" then cz - fd / 2
    when "south" then @room["depth"] - (cz + fd / 2)
    when "west" then cx - fw / 2
    when "east" then @room["width"] - (cx + fw / 2)
    end
  end

  def along_of(object, wall)
    %w[north south].include?(wall) ? object["position"]["x"] : object["position"]["z"]
  end

  # 壁に沿った位置 along と、壁面から物体中心までの距離 offset から、位置と向き (部屋の内側を向く) を返す
  def wall_pose(wall, along, offset)
    case wall
    when "north" then [ along, offset, 0 ]
    when "south" then [ along, @room["depth"] - offset, 180 ]
    when "west" then [ offset, along, 90 ]
    when "east" then [ @room["width"] - offset, along, 270 ]
    end
  end

  def build(item, size, position, rotation, attach_to, note)
    note += "（一部寸法は推定。購入前に商品サイズをご確認ください）" if Array(item.metadata["estimated_axes"]).any?
    object = {
      "id" => self.class.object_id_for(item),
      "source" => "suggested",
      "category" => item.category,
      "label" => item.name,
      "size" => size.transform_values { |v| v.round(3) },
      "position" => position.transform_values { |v| v.to_f.round(3) },
      "rotation_y" => rotation,
      "color" => item.color,
      "model_url" => nil,
      "slot" => item.slot,
      "attach_to" => attach_to,
      "item_id" => item.id,
      "marker" => nil
    }
    Placement.new(object:, note:)
  end
end
