require "timeout"

# Reuse verified EC discovery; search results are candidates, selection is imported afresh.
class FurnitureSearch
  DEADLINE_SECONDS = 130
  Result = Data.define(:products, :color, :failures, :search_entry_points)
  class Error < StandardError; end

  def self.call(query:, color:, category:, user_id:)
    raise Error, "検索語を1〜200文字で入力してください" unless query.is_a?(String) && query.strip.length.between?(1, 200)
    raise Error, "検索する色を確認してください" unless color.blank? || InteriorLinks::ProductColors::PATTERNS.key?(color)
    raise Error, "家具の種類を確認してください" unless category.blank? || Coordination::FLOOR_CATEGORIES.include?(category)
    raise Error, "実商品検索の接続が設定されていません" unless GeminiClient.configured?(user_id:)

    client = InteriorLinks::RealClient.new(user_id:, preferred_categories: category.present? ? [ category ] : Coordination::FLOOR_CATEGORIES)
    search_query = color.present? ? "#{query.strip}。希望する商品の色: #{color}" : query.strip
    candidates = Timeout.timeout(DEADLINE_SECONDS) do
      client.search(prompt: search_query, theme: nil, slots: [ "floor" ], categories: category.present? ? [ category ] : [], max_price: 10_000_000).fetch("floor", [])
    end
    products = candidates.select { |item| InteriorLinks::ProductColors.matches?(item.metadata["official_color"], color) }.first(24)
    Result.new(products:, color: color.presence, failures: Array(client.diagnostics["failures"]).size, search_entry_points: client.search_entry_points)
  rescue InteriorLinks::RealClient::Error => error
    raise Error, error.message
  rescue Timeout::Error
    raise Error, "家具の検索に時間がかかっています。条件を変えて再度お試しください"
  end
end
