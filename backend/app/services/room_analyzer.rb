# 部屋の写真からシーン (部屋の外形 + 今ある家具) を作る。
#
# 現在は AI 未接続のモック。畳数と部屋の形から寸法を決め、ベッド・デスク・本棚・窓を
# 典型的な一人暮らしの配置で置く。LLM に差し替えるときも戻り値の形 (swagger の Scene) は変えない。
#
# 座標系 (Scene 共通):
#   単位はメートル。y が上、原点は北西の床の角。x は東向き (幅)、z は南向き (奥行き)。
#   position は物体の底面中心。rotation_y は度数で、物体の正面 (ローカル +z) が
#   0 => 南, 90 => 東, 180 => 北, 270 => 西 を向く (three.js の rotation.y と同じ向き)。
class RoomAnalyzer
  TATAMI_AREA = 1.62 # 1 畳あたりの面積 (m2)
  ROOM_HEIGHT = 2.4

  def self.call(room)
    new(room).call
  end

  def initialize(room)
    @room = room
  end

  def call
    width, depth = dimensions
    {
      "room" => {
        "width" => width,
        "depth" => depth,
        "height" => ROOM_HEIGHT,
        "wall_color" => "#f4f1ec",
        "floor_color" => "#c8a97e",
        "windows" => [
          { "id" => "window-1", "wall" => "south", "center" => (width / 2).round(2), "width" => 1.2, "bottom" => 0.9, "height" => 1.1 }
        ]
      },
      "objects" => existing_furniture(width, depth)
    }
  end

  private

  # 畳数と部屋の形 (幅 / 奥行き の比) から幅と奥行きを出す
  def dimensions
    area = @room.tatami.to_f * TATAMI_AREA
    width = Math.sqrt(area * Room::SHAPE_RATIOS.fetch(@room.shape))
    [ width.round(2), (area / width).round(2) ]
  end

  def existing_furniture(width, depth)
    [
      furniture("bed-1", "bed", "ベッド", { "w" => 0.97, "h" => 0.45, "d" => 1.95 },
                { "x" => 0.51, "z" => 1.0 }, 0, "#f2f0eb"),
      furniture("desk-1", "desk", "デスク", { "w" => 1.0, "h" => 0.72, "d" => 0.5 },
                { "x" => (width - 0.52).round(2), "z" => 0.27 }, 0, "#a0784f"),
      furniture("shelf-1", "shelf", "本棚", { "w" => 0.8, "h" => 1.8, "d" => 0.3 },
                { "x" => (width - 0.17).round(2), "z" => (depth * 0.6).round(2) }, 270, "#8b6a4a")
    ]
  end

  def furniture(id, category, label, size, position, rotation, color)
    {
      "id" => id,
      "source" => "existing",
      "category" => category,
      "label" => label,
      "size" => size,
      "position" => position.merge("y" => 0.0),
      "rotation_y" => rotation,
      "color" => color,
      "model_url" => nil,
      "slot" => nil,
      "attach_to" => nil,
      "item_id" => nil,
      "marker" => nil
    }
  end
end
