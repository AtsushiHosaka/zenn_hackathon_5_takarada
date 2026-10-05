# 要望文から、足す商品の候補 (枠ごとにおすすめ順) とタイトル・コンセプトを決める。
#
# GEMINI_API_KEY があれば Gemini が要望文と部屋を見て候補を選ぶ (CoordinationPlanner::Gemini)。
# 無ければキーワードでテーマを決めるモック (CoordinationPlanner::Mock)。
# Geminiは予算内で相性のよい採用一式を選び、Rubyが合計と配置を最終確認する。
# Mockの予算調整はCoordinationBuilder、座標はSlotLayoutの責務。
class CoordinationPlanner
  # candidates: 枠・操作グループごとの承認済み商品と代替順位。
  # Geminiの採用一式はanalysis.selection、MockはBuilderで枠ごとに選ぶ。
  # concept: 方向性の説明 (コメントの冒頭) / note: 要望どおりの商品が無いときの断り書き
  # removed_object_ids: 要望文で「いらない」とはっきり書かれた今ある家具 (活かす家具から外す)
  # planned_by: gemini / mock、analysis: 精度の確認用の記録 (coordinations.analysis)
  Plan = Data.define(:title, :concept, :note, :candidates, :removed_object_ids, :planned_by, :analysis)

  # 追加の指示で作り直すときの前回のコーデ。前回の要望・タイトル・商品 (item_id・slot・name) を持つ
  Previous = Data.define(:prompt, :title, :items)

  # 雰囲気が大きく変わる順 (色の面積が大きい布もの → 壁 → 照明 → 小物)
  SLOT_PRIORITY = %w[bed_cover curtain rug wall_decor light display cushion desk_top].freeze

  # kept_objects: 活かす家具 (Scene の object)。部屋の雰囲気に合わせて選ぶのに使う
  def self.call(prompt:, budget:, room:, kept_objects:, user_id: nil, client: nil, additional_candidates: [], previous: nil)
    planner = GeminiClient.configured?(user_id:) ? Gemini : Mock
    planner.new(prompt:, budget:, room:, kept_objects:, user_id:, client:, additional_candidates:, previous:).plan
  end
end
