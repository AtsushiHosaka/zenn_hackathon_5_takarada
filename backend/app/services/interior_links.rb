# コーデの商品候補を出す境界。
#
#   InteriorLinks.client.search(prompt:, theme:, slots:, max_price:)
#     => { "curtain" => [InteriorLinks::Item, ...], ... }
#
# 枠 (slot) ごとに、おすすめ順の商品候補を返す。価格は max_price 以下に絞る。
# theme が nil なら、テーマで絞らずに返す (要望文から Gemini が選ぶときに使う)。
# 選ぶ・置く・予算に収めるのは呼び出し側 (CoordinationBuilder) の責務で、ここは候補を出すだけ。
# 候補は DB の furniture_details (FurnitureDetailClient) から出す。外部の EC は検索しない。
module InteriorLinks
  SLOTS = %w[bed_cover curtain rug wall_decor light display cushion desk_top floor].freeze
  FLOOR_CATEGORIES = %w[sofa bed desk chair shelf table storage tv_stand wardrobe].freeze

  # カテゴリごとの標準寸法 (メートル)。EC から寸法が取れない商品に使う (Item.build)
  DEFAULT_SIZES = {
    "bed_cover" => { "w" => 1.0, "h" => 0.04, "d" => 2.0 },
    "curtain" => { "w" => 1.0, "h" => 2.0, "d" => 0.04 },
    "rug" => { "w" => 1.3, "h" => 0.02, "d" => 1.9 },
    "cushion" => { "w" => 0.45, "h" => 0.15, "d" => 0.45 },
    "floor_lamp" => { "w" => 0.3, "h" => 1.4, "d" => 0.3 },
    "plant" => { "w" => 0.5, "h" => 1.0, "d" => 0.5 }
  }.freeze
  FALLBACK_SIZE = { "w" => 0.3, "h" => 0.3, "d" => 0.3 }.freeze

  def self.provider(**)
    "db"
  end

  def self.client(**)
    FurnitureDetailClient.new
  end
end
