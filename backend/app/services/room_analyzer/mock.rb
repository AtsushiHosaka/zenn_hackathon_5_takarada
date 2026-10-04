class RoomAnalyzer
  # 写真を解析しないモック。典型的な一人暮らしの部屋 (ベッド・デスク・本棚・南の窓) を返す
  class Mock
    def initialize(_room); end

    def meta
      { "analyzer" => "mock" }
    end

    def observe
      {
        "wall_color" => "#f4f1ec",
        "floor_color" => "#c8a97e",
        "windows" => [ { "wall" => "south", "position" => "center", "size" => "medium" } ],
        "furniture" => [
          { "category" => "bed", "label" => "ベッド", "color" => "#f2f0eb", "wall" => "north", "position" => "start",
            "width_m" => 0.97, "height_m" => 0.45, "depth_m" => 1.95 },
          { "category" => "desk", "label" => "デスク", "color" => "#a0784f", "wall" => "north", "position" => "end",
            "width_m" => 1.0, "height_m" => 0.72, "depth_m" => 0.5 },
          { "category" => "shelf", "label" => "本棚", "color" => "#8b6a4a", "wall" => "east", "position" => "center",
            "width_m" => 0.8, "height_m" => 1.8, "depth_m" => 0.3 }
        ]
      }
    end
  end
end
