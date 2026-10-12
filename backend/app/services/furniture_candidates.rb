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

  # 要望から読み取った好み (FurnitureQuery::Result) に商品がどれだけ合うか。色が合えば 2、雰囲気のタグ 1 つにつき 1、形が合えば 1
  def self.score(item, preference)
    return 0 unless preference

    (preference.color && Colors.matches?("#{item.metadata['color_name']} #{item.name}", preference.color) ? 2 : 0) +
      (Array(item.metadata["themes"]) & preference.themes).size + (preference.shapes.include?(item.metadata["shape"]) ? 1 : 0)
  end

  # 並び順を保ったまま、3D モデルの形 (stool_round, chair_office など) ごとに 1 件ずつ順に取って limit 件にする。
  # 先頭から limit 件だと、同じ形が続くカテゴリ (椅子はスツールと食卓用が先に並ぶ) でほかの形が候補に入らないため
  def self.spread(items, limit)
    shapes = items.group_by { |item| item.metadata["shape"] }.values
    (0...shapes.map(&:size).max.to_i).flat_map { |round| shapes.filter_map { |shape| shape[round] } }.first(limit)
  end

  # selected: ユーザーが選んだ detail の候補。枠・カテゴリが合えば先頭に混ぜる
  def self.client(selected: [])
    Client.new(selected:)
  end
end
