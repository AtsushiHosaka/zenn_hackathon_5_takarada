require "timeout"

# Reuse verified EC discovery; search results are candidates, selection is imported afresh.
class FurnitureSearch
  DEADLINE_SECONDS = 130
  Result = Data.define(:products, :color, :failures, :search_entry_points)
  CATEGORIES = (InteriorLinks::ProductParser::CATEGORY_RULES.map(&:first) + [ "small_plant" ]).uniq.freeze
  QUERY_CATEGORY_NAMES = {
    "sofa" => /\b(?:sofas?|couches?)\b/i, "bed" => /\bbeds?\b/i,
    "desk" => /\bdesks?\b/i, "chair" => /\b(?:chairs?|stools?)\b/i,
    "shelf" => /\b(?:shelf|shelves|bookcases?|bookshelves?)\b/i,
    "table" => /\btables?\b/i
  }.freeze
  class Error < StandardError; end

  def self.call(query:, color:, category:, user_id:)
    raise Error, "検索語を1〜200文字で入力してください" unless query.is_a?(String) && query.strip.length.between?(1, 200)
    raise Error, "検索する色を確認してください" unless color.blank? || InteriorLinks::ProductColors::PATTERNS.key?(color)
    raise Error, "家具の種類を確認してください" unless category.blank? || CATEGORIES.include?(category)
    raise Error, "実商品検索の接続が設定されていません" unless GeminiClient.configured?(user_id:)

    categories = requested_categories(query, category)
    client = InteriorLinks::RealClient.new(user_id:, preferred_categories: categories.presence || Coordination::FLOOR_CATEGORIES)
    search_query = color.present? ? "#{query.strip}。希望する商品の色: #{color}" : query.strip
    candidates = Timeout.timeout(DEADLINE_SECONDS) do
      client.search(prompt: search_query, theme: nil, slots: categories.present? ? categories.map { |value| slot_for(value) }.uniq : [ "floor" ], categories:, max_price: 10_000_000).values.flatten
    end
    products = candidates.select { |item| (categories.empty? || categories.include?(item.category)) && InteriorLinks::ProductColors.matches?(item.metadata["official_color"], color) }.first(24)
    Result.new(products:, color: color.presence, failures: Array(client.diagnostics["failures"]).size, search_entry_points: client.search_entry_points)
  rescue InteriorLinks::RealClient::Error => error
    raise Error, error.message
  rescue Timeout::Error
    raise Error, "家具の検索に時間がかかっています。条件を変えて再度お試しください"
  end
  def self.slot_for(category)
    return "desk_top" if category == "small_plant"

    InteriorLinks::ProductParser::CATEGORY_RULES.find { |rule| rule.first == category }&.fetch(1) || "floor"
  end

  def self.requested_categories(query, category)
    return [ category ] if category.present?

    text = query.unicode_normalize(:nfkc).strip
    rules = InteriorLinks::ProductParser::CATEGORY_RULES.map { |value, _, pattern| [ value, pattern ] } + QUERY_CATEGORY_NAMES.to_a
    matches = rules.filter_map do |value, pattern|
      match = pattern.match(text)
      [ value, match ] if match
    end
    categories = matches.map(&:first).uniq
    # Constrain simple searches such as "white chair" or "白い椅子". A noun
    # used as context ("chair cushion", "机に合わせる収納") must not narrow
    # the request to that noun. Ambiguous prose retains the broad search.
    categories.length == 1 && matches.any? { |_, match| match.post_match.empty? } ? categories : []
  end
  private_class_method :requested_categories
end
