# 部屋のシーン (部屋の外形 + 今ある家具) を作る。
#
# 写真があり GEMINI_API_KEY が設定されていれば、写真を Gemini で解析する (RoomAnalyzer::Gemini)。
# どちらかが無ければ、決まった家具を置くモック (RoomAnalyzer::Mock) で作る。
# どちらも「どの壁沿いに何があるか」(観察結果) だけを返し、座標は RoomLayout が計算する。
# 部屋の寸法は写真からは決めず、畳数と部屋の形から出す。
#
# 座標系 (Scene 共通):
#   単位はメートル。y が上、原点は北西の床の角。x は東向き (幅)、z は南向き (奥行き)。
#   position は物体の底面中心。rotation_y は度数で、物体の正面 (ローカル +z) が
#   0 => 南, 90 => 東, 180 => 北, 270 => 西 を向く (three.js の rotation.y と同じ向き)。
#   写真の解析では、1 枚目の写真で正面に見える壁を北とする。
class RoomAnalyzer
  TATAMI_AREA = 1.62 # 1 畳あたりの面積 (m2)
  ROOM_HEIGHT = 2.4

  Result = Data.define(:scene, :analyzed_by)

  def self.call(room)
    new(room).call
  end

  def initialize(room)
    @room = room
  end

  def call
    analyzer, analyzed_by = gemini? ? [ Gemini, "gemini" ] : [ Mock, "mock" ]
    width, depth = dimensions
    scene = RoomLayout.new(width:, depth:, height: ROOM_HEIGHT).build(analyzer.new(@room).observe)
    Result.new(scene:, analyzed_by:)
  end

  private

  def gemini?
    @room.photos.attached? && GeminiClient.configured?
  end

  # 畳数と部屋の形 (幅 / 奥行き の比) から幅と奥行きを出す
  def dimensions
    area = @room.tatami.to_f * TATAMI_AREA
    width = Math.sqrt(area * Room::SHAPE_RATIOS.fetch(@room.shape))
    [ width.round(2), (area / width).round(2) ]
  end
end
