class CoordinationPlanner
  # AI を使わないモック。要望文のキーワードで 3 つのテーマのどれかに決める
  class Mock
    THEMES = {
      "oshi" => { title: "ラベンダーの推し活ルーム", keywords: %w[推し 紫 パープル ラベンダー アクスタ ぬい] },
      "botanical" => { title: "グリーンが映えるボタニカルルーム", keywords: %w[ボタニカル 植物 グリーン 緑 観葉] },
      "korean" => { title: "くすみベージュの韓国風ルーム", keywords: %w[韓国 ベージュ くすみ アイボリー ナチュラル] }
    }.freeze

    def initialize(prompt:, user_id: nil, client: nil, previous: nil, slots: SLOT_PRIORITY, preference: nil, character_theme: nil, **)
      @prompt = prompt
      @slots = slots
      @previous = previous
      @user_id = user_id
      @client = client || FurnitureCandidates.client(user_id: user_id)
      @preference = preference
      @character_theme = character_theme
    end

    def plan
      theme = detect_theme
      items = @client.search(prompt: @prompt, theme: @character_theme ? nil : theme, slots: @slots, preference: @preference, character_theme: @character_theme)
      Plan.new(
        title: THEMES.fetch(theme)[:title],
        concept: nil,
        note: nil,
        candidates: @slots.flat_map { |slot| @character_theme ? character_choices(items.fetch(slot, []), slot) : keep_previous_first(items.fetch(slot, [])) },
        removed_object_ids: [],
        planned_by: "mock",
        analysis: { "meta" => { "planner" => "mock", "theme" => theme } }
      )
    end

    private

    # In the offline demo, large surfaces use ordinary palette furniture and
    # character goods belong to accent slots. User-selected products stay first.
    def character_choices(items, slot)
      selected, automatic = items.partition { |item| item.metadata["selected_by_user"] }
      ordinary, goods = automatic.partition { |item| Array(item.metadata["characters"]).empty? }
      ordinary = keep_previous_first(ordinary)
      goods = keep_previous_first(goods)
      selected + (%w[display wall_decor desk_top].include?(slot) ? goods + ordinary : ordinary + goods)
    end

    # 追加の指示のときは、前回の商品を各枠の先頭にして選ばれやすくする
    def keep_previous_first(items)
      previous_ids = Array(@previous&.items).map { |item| item["item_id"] }
      items.partition { |item| previous_ids.include?(item.id) }.flatten
    end

    def detect_theme
      scores = THEMES.transform_values { |t| t[:keywords].count { |k| @prompt.include?(k) } }
      best, score = scores.max_by { |_, s| s }
      score.positive? ? best : "oshi"
    end
  end
end
