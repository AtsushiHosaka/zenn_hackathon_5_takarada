# 要望文から、足す商品の候補 (枠ごとにおすすめ順) とタイトル・コンセプトを決める。
#
# GEMINI_API_KEY があれば Gemini が要望文と部屋を見て候補を選ぶ (CoordinationPlanner::Gemini)。
# 無ければキーワードでテーマを決めるモック (CoordinationPlanner::Mock)。
# どちらも座標と予算は決めない (予算は CoordinationBuilder、置き場所は SlotLayout の責務)。
class CoordinationPlanner
  # candidates: 枠の優先順に並べた商品 (各枠の中はおすすめ順)。予算内で枠ごとに 1 つ選ばれる
  # concept: 方向性の説明 (コメントの冒頭) / note: 要望どおりの商品が無いときの断り書き
  # planned_by: gemini / mock、analysis: 精度の確認用の記録 (coordinations.analysis)
  Plan = Data.define(:title, :concept, :note, :candidates, :planned_by, :analysis)

  # 雰囲気が大きく変わる順 (色の面積が大きい布もの → 壁 → 照明 → 小物)
  SLOT_PRIORITY = InteriorLinks::SLOTS

  # kept_objects: 活かす家具 (Scene の object)。部屋の雰囲気に合わせて選ぶのに使う
  def self.call(prompt:, budget:, room:, kept_objects:, user_id: nil)
    planner = GeminiClient.configured?(user_id:) ? Gemini : Mock
    planner.new(prompt:, budget:, room:, kept_objects:).plan
  end
end
