# 要望テキストからテーマを決め、インテリアリンク取得 (InteriorLinks) から商品候補をもらって優先順に並べる。
#
# 現在は AI 未接続のモック (キーワードでテーマを判定)。LLM に差し替えるときは
# 「テーマ・タイトル・商品候補」を返す形を保つ。座標は決めない (SlotLayout の責務)。
class CoordinationPlanner
  Plan = Data.define(:theme, :title, :candidates)

  # 雰囲気が大きく変わる順 (色の面積が大きい布もの → 壁 → 照明 → 小物)
  SLOT_PRIORITY = InteriorLinks::SLOTS

  THEMES = {
    "oshi_purple" => { title: "ラベンダーの推し活ルーム", keywords: %w[推し 紫 パープル ラベンダー アクスタ ぬい] },
    "botanical" => { title: "グリーンが映えるボタニカルルーム", keywords: %w[ボタニカル 植物 グリーン 緑 観葉] },
    "korean" => { title: "くすみベージュの韓国風ルーム", keywords: %w[韓国 ベージュ くすみ アイボリー ナチュラル] }
  }.freeze

  def self.call(prompt:, budget:)
    theme = detect_theme(prompt)
    items = InteriorLinks.client.search(prompt:, theme:, slots: SLOT_PRIORITY, max_price: budget)
    candidates = SLOT_PRIORITY.flat_map { |slot| items.fetch(slot, []) }
    Plan.new(theme:, title: THEMES.fetch(theme)[:title], candidates:)
  end

  def self.detect_theme(prompt)
    scores = THEMES.transform_values { |t| t[:keywords].count { |k| prompt.include?(k) } }
    best, score = scores.max_by { |_, s| s }
    score.positive? ? best : "oshi_purple"
  end
  private_class_method :detect_theme
end
