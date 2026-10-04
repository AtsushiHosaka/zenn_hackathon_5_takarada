# 部屋の写真を解析してシーンを作る
class AnalyzeRoomJob < ApplicationJob
  queue_as :default

  def perform(room_id)
    room = Room.find(room_id)
    room.update!(scene: ModelResolver.call(RoomAnalyzer.call(room)), status: "ready")
  rescue StandardError => e
    # 再試行しても結果が変わらないので、失敗として記録して終える
    room&.update!(status: "failed", error_message: e.message)
  end
end
