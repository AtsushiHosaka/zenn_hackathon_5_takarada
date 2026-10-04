# 部屋の写真を解析してシーンを作る (写真と GEMINI_API_KEY があれば Gemini、無ければモック)
class AnalyzeRoomJob < ApplicationJob
  queue_as :default

  def perform(room_id)
    room = Room.find(room_id)
    result = RoomAnalyzer.call(room)
    room.update!(scene: result.scene, analyzed_by: result.analyzed_by, status: "ready")
  rescue StandardError => e
    # 再試行しても結果が変わらないので、失敗として記録して終える
    room&.update!(status: "failed", error_message: e.message)
  end
end
