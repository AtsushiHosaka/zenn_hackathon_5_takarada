# コーデの商品候補 (furniture_details) を出す。
#
#   FurnitureCandidates.client(selected: []).search(theme:, slots:, categories:, preference:)
#     => { "curtain" => [FurnitureCandidates::Item, ...], ... }
#
# 枠 (slot) ごとに並び順どおりの候補を返す。theme が nil ならテーマで絞らない。
# preference (要望から読み取った色・雰囲気・形) を渡すと、合う商品を先にする (同点は並び順)。
# 選ぶ・置くのは呼び出し側 (CoordinationBuilder)。
module FurnitureCandidates
  SLOTS = %w[bed_cover curtain rug wall_decor light display cushion desk_top floor].freeze
  FLOOR_CATEGORIES = %w[sofa bed desk chair shelf table storage tv_stand wardrobe].freeze

  # カテゴリごとの標準寸法 (メートル)。寸法の無い候補に使う (Item.build)
  DEFAULT_SIZES = {
    "bed_cover" => { "w" => 1.0, "h" => 0.04, "d" => 2.0 },
    "curtain" => { "w" => 1.0, "h" => 2.0, "d" => 0.04 },
    "rug" => { "w" => 1.3, "h" => 0.02, "d" => 1.9 },
    "cushion" => { "w" => 0.45, "h" => 0.15, "d" => 0.45 },
    "floor_lamp" => { "w" => 0.3, "h" => 1.4, "d" => 0.3 },
    "plant" => { "w" => 0.5, "h" => 1.0, "d" => 0.5 }
  }.freeze
  FALLBACK_SIZE = { "w" => 0.3, "h" => 0.3, "d" => 0.3 }.freeze

  # 雰囲気のタグ (furniture_details.themes)。商品ごとに 0〜3 個付ける。AI への商品情報、家具検索、モックのテーマの絞り込みに使う
  THEMES = {
    "simple" => "シンプル", "natural" => "ナチュラル", "nordic" => "北欧", "korean" => "韓国風", "cute" => "かわいい",
    "modern" => "モダン", "antique" => "アンティーク", "japanese" => "和風", "botanical" => "ボタニカル", "oshi" => "推し活"
  }.freeze

  # Published color names establish palette matches; preview RGB is never color evidence.
  def self.score(item, preference, character_theme: nil)
    text = "#{item.metadata['color_name']} #{item.name}"
    colors = preference&.color ? [ preference.color ] : Array(character_theme&.fetch("colors", []))
    palette_match = colors.any? { |color| Colors.matches?(text, color) }
    color_score = if palette_match
      character_theme ? 8 : 2
    elsif character_theme && Array(character_theme["neutral_colors"]).any? { |color| Colors.matches?(text, color) }
      3
    else
      0
    end
    color_score + (Array(item.metadata["themes"]) & Array(preference&.themes)).size +
      (Array(preference&.shapes).include?(item.metadata["shape"]) ? 1 : 0) +
      (character_theme && (Array(item.metadata["characters"]) & Array(character_theme["character_keys"])).any? ? 2 : 0)
  end

  # 並び順を保ったまま、3D モデルの形 (stool_round, chair_office など) ごとに 1 件ずつ順に取って limit 件にする。
  # 先頭から limit 件だと、同じ形が続くカテゴリ (椅子はスツールと食卓用が先に並ぶ) でほかの形が候補に入らないため
  # ブロックを渡すと、形の代わりにその値 (種類など) ごとに取る
  def self.spread(items, limit, &key)
    shapes = items.group_by(&key || ->(item) { item.metadata["shape"] }).values
    (0...shapes.map(&:size).max.to_i).flat_map { |round| shapes.filter_map { |shape| shape[round] } }.first(limit)
  end

  # Shape diversity applies only between equally relevant products, so it cannot
  # displace the palette matches before the AI sees the finite candidate list.
  def self.rank(items, preference: nil, character_theme: nil)
    items.group_by { |item| score(item, preference, character_theme:) }.sort_by { |points, _| -points }
      .flat_map { |_, group| spread(group, group.size) }
  end

  def self.compatible_character?(item, character_theme)
    characters = Array(item.metadata["characters"])
    !character_theme || characters.empty? || (characters & Array(character_theme["character_keys"])).any?
  end

  # Keep chosen/previous products eligible, then offer ordinary palette furniture
  # and a smaller set of matching goods. These are options, never forced purchases.
  def self.shortlist(items, limit, preference: nil, character_theme: nil, preferred_ids: [])
    preferred, remaining = items.partition { |item| item.metadata["selected_by_user"] || preferred_ids.include?(item.id) }
    preferred = preferred.first(limit)
    capacity = limit - preferred.size
    return preferred if capacity.zero?

    ranked = rank(remaining.select { |item| compatible_character?(item, character_theme) }, preference:, character_theme:)
    return preferred + ranked.first(capacity) unless character_theme

    ordinary, goods = ranked.partition { |item| Array(item.metadata["characters"]).empty? }
    goods_count = [ goods.size, [ capacity / 4, 1 ].max ].min
    main = ordinary.first(capacity - goods_count)
    accents = goods.first(goods_count)
    extras = (ordinary.drop(main.size) + goods.drop(accents.size)).first(capacity - main.size - accents.size)
    preferred + main + accents + extras
  end

  # selected: ユーザーが選んだ detail の候補。枠・カテゴリが合えば先頭に混ぜる
  # characters: キャラクターのグッズを、このキャラクター (character_key) のものだけにする。nil なら絞らない
  def self.client(selected: [], characters: nil)
    Client.new(selected:, characters:)
  end
end
