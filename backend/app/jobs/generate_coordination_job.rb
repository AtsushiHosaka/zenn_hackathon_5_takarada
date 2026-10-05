# 要望と予算から実ECの商品選定・配置・素材生成まで実行する。認証未設定時はモック。
class GenerateCoordinationJob < ApplicationJob
  queue_as :default
  DEADLINE_SECONDS = 240

  def perform(coordination_id)
    coordination = Coordination.find(coordination_id)
    coordination.update!(status: "processing")
    result = Timeout.timeout(DEADLINE_SECONDS, Timeout::Error, "商品検索と生成が時間内に完了しませんでした。条件を絞って再提案してください") do
      CoordinationBuilder.call(coordination)
    end
    coordination.update!(status: "done", **result.to_h)
  rescue StandardError => e
    # 再試行しても結果が変わらないので、失敗として記録して終える
    attributes = { status: "failed", error_message: e.message }
    if e.respond_to?(:diagnostics)
      attributes[:analysis] = (coordination&.analysis || {}).deep_merge(
        "meta" => { "product_source" => "ec" },
        "ec_search" => e.diagnostics.except("search_entry_point")
      )
    end
    coordination&.update!(attributes)
  end
end
