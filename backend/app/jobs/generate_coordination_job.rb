# 要望と予算からコーデを組み立てる
class GenerateCoordinationJob < ApplicationJob
  queue_as :default

  def perform(coordination_id)
    coordination = Coordination.find(coordination_id)
    coordination.update!(status: "processing")
    result = CoordinationBuilder.call(coordination)
    attributes = result.to_h.merge(after_scene: ModelResolver.call(result.after_scene))
    coordination.update!(status: "done", **attributes)
  rescue StandardError => e
    # 再試行しても結果が変わらないので、失敗として記録して終える
    coordination&.update!(status: "failed", error_message: e.message)
  end
end
