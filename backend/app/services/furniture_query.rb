# 家具検索の検索語と、コーデの要望文を、絞り込み・並べ替えの条件 (カテゴリ・3D モデルの形・色・雰囲気のタグ) に解釈する。
# 「白い椅子」「北欧っぽいラグ」のように種類・色・雰囲気の言葉だけなら規則で読む (色と雰囲気。種類は FurnitureSearch が読む)。
# それ以外の言葉が残るとき (「くつろげる椅子」) だけ Gemini に選ばせる。Gemini が使えない・失敗したときは規則で読めた分だけを返す。
class FurnitureQuery
  Result = Data.define(:categories, :shapes, :color, :themes, :source)

  # 色の言葉の前後に付く語。規則で読んだあとに残っても、意味のある言葉とはみなさない
  FILLER = /[\s　、,・]|っぽい|ぽい|系|色|カラー|風|の|な|い|で|を|が|に|と/

  def self.call(query, user_id: nil)
    text = query.to_s.unicode_normalize(:nfkc).strip
    themes = FurnitureCandidates::THEMES.select { |_, name| text.include?(name) }.keys
    # 雰囲気の言葉 (ナチュラルなど) を色の言葉として読まないよう、先に取り除く
    rest = FurnitureCandidates::THEMES.values_at(*themes).reduce(text) { |remaining, name| remaining.gsub(name, "") }
    color = FurnitureCandidates::Colors::PATTERNS.find { |_, pattern| pattern.match?(rest) }&.first
    result = Result.new(categories: [], shapes: [], color:, themes:, source: "rules")
    words = [ FurnitureCandidates::Colors::PATTERNS[color], *FurnitureCandidates::Categories::RULES.map(&:last), *FurnitureSearch::QUERY_CATEGORY_NAMES.values ].compact
    return result if words.reduce(rest) { |remaining, pattern| remaining.gsub(pattern, "") }.gsub(FILLER, "").empty?

    # 規則で読めた色と雰囲気は、Gemini が落としても残す
    llm = interpret_with_llm(text, user_id:) or return result
    llm.with(color: llm.color || color, themes: llm.themes | themes)
  end

  def self.interpret_with_llm(text, user_id:)
    return unless GeminiClient.configured?(user_id:)

    shapes = shape_names
    json = GeminiClient.new.generate_json(prompt: prompt(text, shapes), schema: schema(shapes.keys)).json
    pick = ->(key, ids) { Array(json[key]).map(&:to_s).select { |id| ids.include?(id) }.uniq }
    Result.new(categories: pick.call("categories", FurnitureSearch::CATEGORIES), shapes: pick.call("shapes", shapes.keys),
               color: FurnitureCandidates::Colors::PATTERNS.key?(json["color"]) ? json["color"] : nil,
               themes: pick.call("themes", FurnitureCandidates::THEMES.keys), source: "llm")
  # 読み取りは補助なので、通信の失敗などで検索・提案そのものを止めない
  rescue StandardError => error
    Rails.logger.info("FurnitureQuery LLM skipped: #{error.class}: #{error.message}")
    nil
  end

  # 商品がある 3D モデルの形と、その家具の名前 (例: chair_lounge => ラウンジチェア)
  def self.shape_names
    Furniture3DModel.joins(furniture: :details).merge(Furniture.available).merge(FurnitureDetail.available)
      .distinct.order(:shape).pluck(:shape, "furnitures.category", "furnitures.name").to_h { |shape, category, name| [ shape, "#{category} / #{name}" ] }
  end

  def self.prompt(text, shapes)
    <<~PROMPT
      家具・インテリア商品の検索語 (または部屋づくりの要望文) を、下の一覧のIDだけで絞り込みの条件に直してください。
      検索語に書かれていること、はっきり読み取れることだけを選びます。読み取れない項目は空にします。
      - categories: 探している家具の種類
      - shapes: 用途や形の言い回しに合う形 (「くつろげる椅子」ならラウンジチェアの形)。種類だけなら空
      - color: 色の指定。無ければ空文字
      - themes: 雰囲気の指定
      検索語: #{text.first(600)}
      家具の種類: #{FurnitureSearch::CATEGORIES.join(' / ')}
      形 (ID: 種類 / 名前): #{shapes.map { |id, name| "#{id}: #{name}" }.join(' | ')}
      色: #{FurnitureCandidates::Colors::PATTERNS.keys.join(' / ')}
      雰囲気: #{FurnitureCandidates::THEMES.map { |id, name| "#{id}: #{name}" }.join(' / ')}
    PROMPT
  end

  def self.schema(shapes)
    list = ->(ids) { { type: "array", items: { type: "string", enum: ids } } }
    { type: "object",
      properties: { categories: list.call(FurnitureSearch::CATEGORIES), shapes: list.call(shapes),
                    color: { type: "string", enum: FurnitureCandidates::Colors::PATTERNS.keys + [ "" ] }, themes: list.call(FurnitureCandidates::THEMES.keys) },
      required: %w[categories shapes color themes] }
  end
  private_class_method :interpret_with_llm, :shape_names, :prompt, :schema
end
