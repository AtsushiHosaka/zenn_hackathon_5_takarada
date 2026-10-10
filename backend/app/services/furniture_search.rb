# 登録済みの furniture_details を検索する。外部の EC は検索しない。
# 家具 (モデル) ごとに 1 件を返し、同じ家具の他の色・寸法・購入先は variants に入れる。
# 検索語が推し活グッズ (キャラクター・フランチャイズ・グッズ種別) と解釈できたら、グッズの 3D モデルも models で返す。
class FurnitureSearch
  MAX_RESULTS = 24
  Result = Data.define(:products, :color, :interpretation, :models)
  Product = Data.define(:detail, :variants)
  CATEGORIES = (FurnitureCandidates::Categories::RULES.map(&:first) + [ "small_plant" ]).uniq.freeze
  QUERY_CATEGORY_NAMES = {
    "sofa" => /\b(?:sofas?|couch(?:es)?)\b/i, "bed" => /\bbeds?\b/i,
    "desk" => /\bdesks?\b/i, "chair" => /\b(?:chairs?|stools?)\b/i,
    "shelf" => /\b(?:shelf|shelves|bookcases?|bookshelf|bookshelves)\b/i,
    "table" => /\btables?\b/i
  }.freeze
  class Error < StandardError; end

  def self.call(query:, color:, category:, user_id: nil)
    raise Error, "検索語を1〜200文字で入力してください" unless query.is_a?(String) && query.strip.length.between?(1, 200)
    raise Error, "検索する色を確認してください" unless color.blank? || FurnitureCandidates::Colors::PATTERNS.key?(color)
    raise Error, "家具の種類を確認してください" unless category.blank? || CATEGORIES.include?(category)

    interpretation = category.blank? ? CharacterQuery.call(query, user_id:) : CharacterQuery::EMPTY
    return goods_search(color:, interpretation:) if interpretation.goods_search?

    categories = requested_categories(query, category)
    scope = FurnitureDetail.joins(:furniture).merge(Furniture.available).includes(furniture: { characters: :franchise }).order(:position, :id)
    details = (categories.any? ? scope.where(category: categories) : scope.where(slot: "floor")).to_a
    tokens = query.unicode_normalize(:nfkc).downcase.split(/[\s、,]+/).reject(&:blank?)
    scored = details.map { |detail| [ detail, tokens.count { |token| detail.name.unicode_normalize(:nfkc).downcase.include?(token) } ] }
    # No name contains the words (e.g. "白い椅子"): the category alone narrows the results.
    scored = scored.select { |_, score| score.positive? } if scored.any? { |_, score| score.positive? }
    matches = scored.sort_by.with_index { |(_, score), index| [ -score, index ] }.map(&:first)
    Result.new(products: products(matches, details, color), color: color.presence, interpretation:, models: [])
  end

  # 家具ごとに 1 件。色で絞り、同じ家具の detail を variants に入れる
  def self.products(matches, details, color)
    matches = matches.select { |detail| FurnitureCandidates::Colors.matches?(detail.metadata["official_color"].presence || detail.color_name.presence || detail.name, color) }
    siblings = details.group_by { |detail| [ detail.furniture_id, detail.category ] }
    matches.uniq { |detail| [ detail.furniture_id, detail.category ] }.first(MAX_RESULTS)
      .map { |detail| Product.new(detail:, variants: siblings.fetch([ detail.furniture_id, detail.category ])) }
  end

  # 推し活グッズ: キャラクターとグッズ種別が合う家具の 3D モデルと、その家具の detail を返す。
  # 順位: キャラクターと種別が一致、キャラクターだけ一致、キャラクターの無い種別のテンプレート。
  def self.goods_search(color:, interpretation:)
    wanted = wanted_characters(interpretation)
    categories = interpretation.categories
    furnitures = Furniture.available.where(category: categories.presence || GoodsCategories.categories)
      .includes(:model, characters: :franchise).order(:id).to_a
    ranked = furnitures.filter_map do |furniture|
      keys = furniture.characters.map(&:character_key)
      if (keys & wanted).any?
        [ furniture, categories.empty? || categories.include?(furniture.category) ? 0 : 1 ]
      elsif keys.empty? && (categories.empty? || categories.include?(furniture.category))
        [ furniture, 2 ]
      end
    end.sort_by.with_index { |(_, rank), index| [ rank, index ] }
    # キャラクターを探しているときは、キャラクターの付いていない家具の商品 (一般のクッションなど) は出さない
    sold = wanted.any? ? ranked.reject { |_, rank| rank == 2 } : ranked
    ranked = ranked.map(&:first)
    details = FurnitureDetail.where(furniture: sold.map(&:first)).includes(furniture: { characters: :franchise }).order(:position, :id).to_a
      .sort_by.with_index { |detail, index| [ ranked.index(detail.furniture), index ] }
    Result.new(products: products(details, details, color), color: color.presence, interpretation:,
               models: ranked.filter_map(&:model).first(MAX_RESULTS))
  end

  # キャラクター名がなくフランチャイズだけなら、そのフランチャイズのキャラクター全員
  def self.wanted_characters(interpretation)
    return interpretation.characters if interpretation.characters.any?

    Character.joins(:franchise).where(franchises: { franchise_key: interpretation.franchises }).pluck(:character_key)
  end

  def self.slot_for(category)
    return "desk_top" if category == "small_plant"

    FurnitureCandidates::Categories::RULES.find { |rule| rule.first == category }&.fetch(1) || "floor"
  end

  def self.requested_categories(query, category)
    return [ category ] if category.present?

    text = query.unicode_normalize(:nfkc).strip
    rules = FurnitureCandidates::Categories::RULES.map { |value, _, pattern| [ value, pattern ] } + QUERY_CATEGORY_NAMES.to_a
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
  private_class_method :requested_categories, :products, :goods_search, :wanted_characters
end
