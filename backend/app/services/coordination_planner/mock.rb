class CoordinationPlanner
  # AI を使わないモック。要望文のキーワードで 3 つのテーマのどれかに決める
  class Mock
    THEMES = {
      "oshi_purple" => { title: "ラベンダーの推し活ルーム", keywords: %w[推し 紫 パープル ラベンダー アクスタ ぬい] },
      "botanical" => { title: "グリーンが映えるボタニカルルーム", keywords: %w[ボタニカル 植物 グリーン 緑 観葉] },
      "korean" => { title: "くすみベージュの韓国風ルーム", keywords: %w[韓国 ベージュ くすみ アイボリー ナチュラル] }
    }.freeze

    def initialize(prompt:, budget:, user_id: nil, client: nil, previous: nil, **)
      @prompt = prompt
      @budget = budget
      @previous = previous
      @user_id = user_id
      @client = client || InteriorLinks.client(user_id: user_id)
    end

    def plan
      theme = detect_theme
      items = @client.search(prompt: @prompt, theme:, slots: SLOT_PRIORITY, max_price: @budget)
      Plan.new(
        title: THEMES.fetch(theme)[:title],
        concept: nil,
        note: nil,
        candidates: SLOT_PRIORITY.flat_map { |slot| keep_previous_first(items.fetch(slot, [])) },
        removed_object_ids: [],
        planned_by: "mock",
        analysis: { "meta" => { "planner" => "mock", "theme" => theme } }
      )
    end

    private

    # 追加の指示のときは、前回の商品を各枠の先頭にして選ばれやすくする
    def keep_previous_first(items)
      previous_ids = Array(@previous&.items).map { |item| item["item_id"] }
      items.partition { |item| previous_ids.include?(item.id) }.flatten
    end

    def detect_theme
      scores = THEMES.transform_values { |t| t[:keywords].count { |k| @prompt.include?(k) } }
      best, score = scores.max_by { |_, s| s }
      score.positive? ? best : "oshi_purple"
    end
  end
end
