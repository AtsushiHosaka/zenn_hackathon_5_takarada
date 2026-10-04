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

  def initialize(scene, kept_objects, edited_objects: [], reserved_object_ids: [])
    @room = scene.fetch("room")
    @objects = kept_objects
    @edited_objects = edited_objects.index_by { |edit| edit["id"] }
    @floor_rects = kept_objects.map { |o| footprint(o) }
    @wall_spans = Hash.new { |h, k| h[k] = [] }
    @reserved_edit_ids = []
    edited_objects.each { |edit| reserve_edit(edit) if reserved_object_ids.include?(edit["id"]) }
  end

  def place(item)
    if (edit = @edited_objects["item-#{item.id}"])
      reserve_edit(edit)
      placement = build(item, edit["size"], edit["position"], edit["rotation_y"], nil, "調整した配置")
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
    end
  end

  private

  def reserve_edit(edit)
    return if @reserved_edit_ids.include?(edit["id"])

    @reserved_edit_ids << edit["id"]
    if edit["position"]["y"] <= 0.05 && edit["slot"] != "rug"
      occupy_floor(edit["position"]["x"], edit["position"]["z"], edit["size"], edit["rotation_y"])
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
    size = { "w" => bed["size"]["w"] + 0.08, "h" => 0.06, "d" => bed["size"]["d"] + 0.04 }
    position = clamp_inside(bed["position"].merge("y" => bed["size"]["h"] - 0.02), size, bed["rotation_y"])
    build(item, size, position, bed["rotation_y"], bed["id"], "ベッドに掛ける")
  end

  def place_cushion(item)
    bed = find("bed") or return
    x, z = local_to_world(bed, 0, -(bed["size"]["d"] / 2 - 0.3))
    position = { "x" => x, "y" => bed["size"]["h"] + 0.04, "z" => z }
    build(item, item.size, position, bed["rotation_y"], bed["id"], "ベッドの枕元")
  end

  def place_desk_top(item)
    desk = find("desk") or return
    lx = desk["size"]["w"] / 2 - item.size["w"] / 2 - 0.08
    lz = -(desk["size"]["d"] / 2 - item.size["d"] / 2 - 0.05)
    x, z = local_to_world(desk, lx, lz)
    build(item, item.size, { "x" => x, "y" => desk["size"]["h"], "z" => z }, desk["rotation_y"], desk["id"], "デスクの上")
  end

  # --- 壁・窓の枠 ---

  def place_curtain(item)
    window = @room["windows"]&.first or return
    height = [ window["bottom"] + window["height"] + 0.15, @room["height"] - 0.05 ].min
    size = { "w" => window["width"] + 0.4, "h" => height, "d" => item.size["d"] }
    x, z, rotation = wall_pose(window["wall"], window["center"], size["d"] / 2 + 0.05)
    build(item, size, { "x" => x, "y" => 0.0, "z" => z }, rotation, window["id"], "窓")
  end

  def place_wall_decor(item)
    [ find("desk"), find("bed") ].compact.each do |anchor|
      wall = back_wall(anchor["rotation_y"])
      bottom = [ anchor["size"]["h"] + 0.3, 1.0 ].max
      along = free_wall_position(wall, along_of(anchor, wall), item.size["w"], bottom, bottom + item.size["h"]) or next
      @wall_spans[wall] << [ along - item.size["w"] / 2, along + item.size["w"] / 2, bottom, bottom + item.size["h"] ]
      x, z, rotation = wall_pose(wall, along, item.size["d"] / 2 + 0.01)
      return build(item, item.size, { "x" => x, "y" => bottom, "z" => z }, rotation, anchor["id"], "#{anchor['label']}の上の壁")
    end
    nil
  end

  # 窓や他の壁飾りと重ならない位置を、希望位置から近い順に探す
  def free_wall_position(wall, preferred, width, bottom, top)
    length = %w[north south].include?(wall) ? @room["width"] : @room["depth"]
    blocked = @wall_spans[wall] + windows_on(wall)
    candidates = (0..(length / GRID_STEP)).map { |i| i * GRID_STEP }
                                          .select { |c| c - width / 2 >= MARGIN && c + width / 2 <= length - MARGIN }
    candidates.sort_by { |c| (c - preferred).abs }.find do |c|
      blocked.none? { |l, r, b, t| c - width / 2 < r && c + width / 2 > l && bottom < t && top > b }
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

  def place_display(item)
    anchor = find("shelf") || find("desk") or return
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
    return unless x

    occupy_floor(x, z, item.size, rotation)
    build(item, item.size, { "x" => x, "y" => 0.0, "z" => z }, rotation, anchor["id"], "#{anchor['label']}の横")
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
    object = {
      "id" => "item-#{item.id}",
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
