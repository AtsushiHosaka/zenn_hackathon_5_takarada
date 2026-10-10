require "timeout"

# Reuse verified EC discovery; search results are candidates, selection is imported afresh.
class FurnitureSearch
  DEADLINE_SECONDS = 130
  Result = Data.define(:products, :color, :failures, :search_entry_points, :interpretation, :models) do
    def initialize(products:, color:, failures:, search_entry_points:, interpretation: CharacterQuery::EMPTY, models: [])
      super
    end
  end
  # グッズ種別ごとに、EC商品のカテゴリ (ProductParser::CATEGORY_RULES) へ対応させる
  GOODS_CATEGORIES = { "acrylic_stand" => "oshi_goods", "can_badge" => "oshi_goods", "uchiwa" => "oshi_goods",
                       "rubber_mat" => "oshi_goods", "acrylic_panel" => "oshi_goods", "figure" => "oshi_goods",
                       "tapestry" => "tapestry", "plush" => "plush", "cushion" => "cushion",
                       "poster" => "wall_art", "blanket" => "blanket", "body_pillow" => "cushion",
                       "standee" => "oshi_goods", "acrylic_diorama" => "oshi_goods", "penlight" => "oshi_goods",
                       "bed_cover" => "bed_cover", "rug" => "rug" }.freeze
  # 掛け時計・マグカップ・ルームライトはEC商品のカテゴリがないため、台帳のモデルだけを返す
  MAX_MODELS = 24
  CATEGORIES = (InteriorLinks::ProductParser::CATEGORY_RULES.map(&:first) + [ "small_plant" ]).uniq.freeze
  QUERY_CATEGORY_NAMES = {
    "sofa" => /\b(?:sofas?|couch(?:es)?)\b/i, "bed" => /\bbeds?\b/i,
    "desk" => /\bdesks?\b/i, "chair" => /\b(?:chairs?|stools?)\b/i,
    "shelf" => /\b(?:shelf|shelves|bookcases?|bookshelf|bookshelves)\b/i,
    "table" => /\btables?\b/i
  }.freeze
  class Error < StandardError; end

  def self.call(query:, color:, category:, user_id:)
    raise Error, "検索語を1〜200文字で入力してください" unless query.is_a?(String) && query.strip.length.between?(1, 200)
    raise Error, "検索する色を確認してください" unless color.blank? || InteriorLinks::ProductColors::PATTERNS.key?(color)
    raise Error, "家具の種類を確認してください" unless category.blank? || CATEGORIES.include?(category)

    interpretation = CharacterQuery.call(query, user_id:)
    return goods_search(color:, category:, user_id:, interpretation:) if interpretation.goods_search?

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
  # 推し活グッズ: 台帳のモデルと、正式名・グッズ種別名で探したEC商品を返す (specs/character-goods/spec.md)
  # 台帳のモデルはECに依存しないため、EC検索が未設定・失敗でもモデルだけは返す。
  def self.goods_search(color:, category:, user_id:, interpretation:)
    models = goods_models(interpretation)
    unless GeminiClient.configured?(user_id:)
      return Result.new(products: [], color: color.presence, failures: 0, search_entry_points: [], interpretation:, models:)
    end

    categories = category.present? ? [ category ] : goods_categories(interpretation)
    client = InteriorLinks::RealClient.new(user_id:, preferred_categories: [])
    search_query = goods_query(interpretation)
    search_query += "。希望する商品の色: #{color}" if color.present?
    candidates = Timeout.timeout(DEADLINE_SECONDS) do
      client.search(prompt: search_query, theme: nil, slots: categories.map { |value| slot_for(value) }.uniq, categories:, max_price: 10_000_000).values.flatten
    end
    products = candidates.select { |item| categories.include?(item.category) && InteriorLinks::ProductColors.matches?(item.metadata["official_color"], color) }
    products = rank_goods(products, interpretation).first(24)
    Result.new(products:, color: color.presence, failures: Array(client.diagnostics["failures"]).size, search_entry_points: client.search_entry_points,
               interpretation:, models:)
  rescue InteriorLinks::RealClient::Error, Timeout::Error => error
    Rails.logger.warn("Goods EC search failed (#{error.class.name}); returning catalog models only")
    Result.new(products: [], color: color.presence, failures: 1, search_entry_points: [], interpretation:, models:)
  end

  # 例: 初音ミク アクリルスタンド。フランチャイズだけならフランチャイズ名を使う。
  def self.goods_query(interpretation)
    names = interpretation.characters.map { |id| CharacterCatalog.character(id)["name"] }
    franchises = interpretation.franchises.map { |id| CharacterCatalog.franchise(id)["name"] }
    goods = interpretation.goods_types.map { |id| CharacterCatalog.goods_type(id)["name"] }
    text = ((names.presence || franchises) + goods).join(" ")
    note = if names.any? then "商品名に「#{names.join('」か「')}」を含む"
    elsif franchises.any? then "#{franchises.join('・')}のキャラクターの"
    else "キャラクターの"
    end
    "#{text}（推し活のキャラクターグッズ。#{note}、部屋に飾る実物の商品。キーホルダー・衣類・スマホケースは除く）"
  end

  def self.goods_categories(interpretation)
    ids = interpretation.goods_types.presence || CharacterCatalog::GOODS_TYPES.keys
    ids.filter_map { |id| GOODS_CATEGORIES[id] }.uniq
  end

  # キャラクター付きとして返すのは、商品名に正式名か曖昧でない別名がある商品だけ。
  # 順位: キャラクター一致、グッズ種別一致、価格。
  def self.rank_goods(products, interpretation)
    wanted = wanted_characters(interpretation)
    franchise_names = interpretation.franchises.flat_map { |id| names_for(CharacterCatalog.franchise(id)) }
    goods_names = interpretation.goods_types.flat_map { |id| row = CharacterCatalog.goods_type(id); [ row["name"], *row["synonyms"] ] }
                                .map { |text| CharacterQuery.fold(CharacterQuery.normalize(text)) }
    candidates = wanted.any? ? wanted.map { |id| CharacterCatalog.character(id) } : CharacterCatalog::CHARACTERS.values
    ranked = products.filter_map do |item|
      name = CharacterQuery.fold(CharacterQuery.normalize(item.name))
      confirmed = candidates.select { |row| names_for(row).any? { |text| name.include?(text) } }.map { |row| row["id"] }
      next unless wanted.empty? || confirmed.any? || franchise_names.any? { |text| name.include?(text) }

      item = item.with(metadata: item.metadata.merge("characters" => confirmed))
      [ item, wanted.any? && confirmed.any? ? 0 : 1, goods_names.any? { |text| name.include?(text) } ? 0 : 1 ]
    end
    ranked.sort_by.with_index { |(item, character_rank, goods_rank), index| [ character_rank, goods_rank, item.price, index ] }.map(&:first)
  end

  # 台帳のモデル: キャラクターとグッズ種別が一致、キャラクターだけ一致、グッズ種別のテンプレートの順。
  def self.goods_models(interpretation)
    wanted = wanted_characters(interpretation)
    goods = interpretation.goods_types
    models = FurnitureModel.available.where.not(goods_type: nil).includes(:bindings).order(:key).to_a
    ranked = models.filter_map do |model|
      character_match = (model.characters & wanted).any?
      goods_match = goods.empty? || goods.include?(model.goods_type)
      if character_match
        [ model, goods.include?(model.goods_type) ? 0 : 1 ]
      elsif model.characters.empty? && goods_match
        [ model, 2 ]
      end
    end
    ranked.sort_by.with_index { |(_, rank), index| [ rank, index ] }.map(&:first).first(MAX_MODELS)
  end

  # キャラクター名がなくフランチャイズだけなら、そのフランチャイズのキャラクター全員
  def self.wanted_characters(interpretation)
    return interpretation.characters if interpretation.characters.any?

    CharacterCatalog::CHARACTERS.values.select { |row| interpretation.franchises.include?(row["franchise"]) }.map { |row| row["id"] }
  end

  def self.names_for(row)
    texts = [ row["name"], *row["aliases"].reject { |item| item["ambiguous"] }.map { |item| item["text"] } ]
    texts.map { |text| CharacterQuery.fold(CharacterQuery.normalize(text)) }.uniq
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
  private_class_method :requested_categories, :goods_search, :goods_query, :goods_categories, :rank_goods, :wanted_characters, :names_for
end
