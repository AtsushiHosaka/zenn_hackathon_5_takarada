# 要望と予算からコーデを組み立てる
class GenerateCoordinationJob < ApplicationJob
  queue_as :default

  def perform(coordination_id)
    coordination = Coordination.find(coordination_id)
    coordination.update!(status: "processing")
    result = CoordinationBuilder.call(coordination)
    coordination.update!(status: "done", **result.to_h)
  rescue StandardError => e
    # 再試行しても結果が変わらないので、失敗として記録して終える
    coordination&.update!(status: "failed", error_message: e.message)
  end
end
