# 登録済みの furniture_details を検索する。外部の EC は検索しない。
# 家具 (モデル) ごとに 1 件を返し、同じ家具の他の色・寸法・購入先は variants に入れる。
class FurnitureSearch
  MAX_RESULTS = 24
  Result = Data.define(:products, :color)
  Product = Data.define(:detail, :variants)
  CATEGORIES = (InteriorLinks::ProductCategories::RULES.map(&:first) + [ "small_plant" ]).uniq.freeze
  QUERY_CATEGORY_NAMES = {
    "sofa" => /\b(?:sofas?|couch(?:es)?)\b/i, "bed" => /\bbeds?\b/i,
    "desk" => /\bdesks?\b/i, "chair" => /\b(?:chairs?|stools?)\b/i,
    "shelf" => /\b(?:shelf|shelves|bookcases?|bookshelf|bookshelves)\b/i,
    "table" => /\btables?\b/i
  }.freeze
  class Error < StandardError; end

  def self.call(query:, color:, category:, **)
    raise Error, "検索語を1〜200文字で入力してください" unless query.is_a?(String) && query.strip.length.between?(1, 200)
    raise Error, "検索する色を確認してください" unless color.blank? || InteriorLinks::ProductColors::PATTERNS.key?(color)
    raise Error, "家具の種類を確認してください" unless category.blank? || CATEGORIES.include?(category)

    categories = requested_categories(query, category)
    scope = FurnitureDetail.joins(:furniture).merge(Furniture.available).includes(:furniture).order(:position, :id)
    details = (categories.any? ? scope.where(category: categories) : scope.where(slot: "floor")).to_a
    tokens = query.unicode_normalize(:nfkc).downcase.split(/[\s、,]+/).reject(&:blank?)
    scored = details.map { |detail| [ detail, tokens.count { |token| detail.name.unicode_normalize(:nfkc).downcase.include?(token) } ] }
    # No name contains the words (e.g. "白い椅子"): the category alone narrows the results.
    scored = scored.select { |_, score| score.positive? } if scored.any? { |_, score| score.positive? }
    matches = scored.sort_by.with_index { |(_, score), index| [ -score, index ] }.map(&:first)
      .select { |detail| InteriorLinks::ProductColors.matches?(detail.metadata["official_color"].presence || detail.color_name.presence || detail.name, color) }
    siblings = details.group_by { |detail| [ detail.furniture_id, detail.category ] }
    products = matches.uniq { |detail| [ detail.furniture_id, detail.category ] }.first(MAX_RESULTS)
      .map { |detail| Product.new(detail:, variants: siblings.fetch([ detail.furniture_id, detail.category ])) }
    Result.new(products:, color: color.presence)
  end

  def self.slot_for(category)
    return "desk_top" if category == "small_plant"

    InteriorLinks::ProductCategories::RULES.find { |rule| rule.first == category }&.fetch(1) || "floor"
  end

  def self.requested_categories(query, category)
    return [ category ] if category.present?

    text = query.unicode_normalize(:nfkc).strip
    rules = InteriorLinks::ProductCategories::RULES.map { |value, _, pattern| [ value, pattern ] } + QUERY_CATEGORY_NAMES.to_a
    matches = rules.filter_map do |value, pattern|
      [ value, pattern ] if pattern.match?(text)
    end
    categories = matches.map(&:first).uniq
    # Constrain simple searches such as "white chair" or "白い椅子". A noun
    # used as context ("chair cushion", "机に合わせる収納") must not narrow
    # the request to that noun. Ambiguous prose retains the broad search.
    # Anchor before matching so alternatives such as ソファ|ソファー can
    # backtrack to the complete terminal noun instead of stopping early.
    categories.length == 1 && matches.any? { |_, pattern| Regexp.new("(?:#{pattern.source})\\z", pattern.options).match?(text) } ? categories : []
  end
  private_class_method :requested_categories
end
