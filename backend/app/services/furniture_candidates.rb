# コーデの商品候補 (furniture_details) を出す。
#
#   FurnitureCandidates.client(selected: []).search(theme:, slots:, max_price:, categories:)
#     => { "curtain" => [FurnitureCandidates::Item, ...], ... }
#
# 枠 (slot) ごとに並び順どおりの候補を返す。価格は max_price 以下。theme が nil ならテーマで絞らない。
# 選ぶ・置く・予算に収めるのは呼び出し側 (CoordinationBuilder)。
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

  # カテゴリの中の種類 (furniture_details.kind)。種類を分けたいカテゴリだけ書く
  KINDS = {
    "chair" => %w[dining_chair desk_chair lounge_chair folding_chair counter_chair stool]
  }.freeze

  # 並び順を保ったまま、種類ごとに 1 件ずつ順に取って limit 件にする。
  # 先頭から limit 件だと、同じ種類が続くカテゴリ (椅子) でほかの種類が候補に入らないため。種類の無い商品はまとめて 1 つの種類として扱う
  def self.spread(items, limit)
    kinds = items.group_by { |item| item.metadata["kind"] }.values
    (0...kinds.map(&:size).max.to_i).flat_map { |round| kinds.filter_map { |kind| kind[round] } }.first(limit)
  end

  # selected: ユーザーが選んだ detail の候補。枠・予算・カテゴリが合えば先頭に混ぜる
  def self.client(selected: [])
    Client.new(selected:)
  end
end
