# 要望と予算から、登録された家具の選定・配置・素材生成まで実行する。Gemini 未設定時はモックのプランナー。
class GenerateCoordinationJob < ApplicationJob
  queue_as :default
  DEADLINE_SECONDS = 240

  def perform(coordination_id)
    coordination = Coordination.find(coordination_id)
    coordination.update!(status: "processing")
    result = Timeout.timeout(DEADLINE_SECONDS, Timeout::Error, "提案の生成が時間内に完了しませんでした。条件を絞って再提案してください") do
      CoordinationBuilder.call(coordination)
    end
    coordination.update!(status: "done", **result.to_h)
  rescue StandardError => e
    # 再試行しても結果が変わらないので、失敗として記録して終える
    coordination&.update!(status: "failed", error_message: e.message)
  end
end
