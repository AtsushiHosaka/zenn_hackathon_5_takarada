# 検索語を推し活グッズの解釈 (キャラクター・フランチャイズ・グッズ種別) に変換する。
# 辞書 (config/characters.json) の別名を最長一致で探し、曖昧な別名は手掛かりの語があるときだけ使う。
# 辞書で何も見つからず、グッズを探していそうな検索語に限り Gemini で辞書 ID を選ばせる (specs/character-goods/spec.md)。
class CharacterQuery
  Result = Data.define(:characters, :franchises, :goods_types, :source) do
    # キャラクター・フランチャイズ、または単独で使えるグッズ種別があればグッズ検索
    def goods_search?
      characters.any? || franchises.any? || goods_types.any? { |id| CharacterCatalog.goods_type(id)["standalone"] }
    end
  end
  EMPTY = Result.new(characters: [], franchises: [], goods_types: [], source: "none")

  # 曖昧な別名の直後にあると「〜の形・色・柄」の意味になる語 (プリン型、シナモン色、マリン柄)
  DESCRIPTIVE_SUFFIX = /\A(?:型|形|柄|色|風|調|系|模様|味|っぽ|みたい|のよう)/
  # 辞書に無いキャラクター名でも、グッズを探していると分かる語 (ひらがなはカタカナへ寄せた後の表記)
  FAN_WORDS = /グッズ|推シ|オシカツ|oshi|vtuber|ブイチューバー|ライバー|キャラ|コラボ|公式/
  KATAKANA = /[\p{Katakana}ー]/
  KANJI = /\p{Han}/
  LATIN = /[a-z0-9]/

  def self.normalize(text)
    text.to_s.unicode_normalize(:nfkc).downcase.gsub(/\s+/, " ").strip
  end

  # ひらがなをカタカナへ寄せる。1文字ずつの置換なので、元の文字列と位置が一致する。
  def self.fold(text)
    text.tr("ぁ-ゖ", "ァ-ヶ")
  end

  def self.entries
    @entries ||= begin
      rows = CharacterCatalog::CHARACTERS.values.flat_map do |row|
        row["aliases"].map { |item| [ item["text"], :character, row["id"], item["ambiguous"] ] } + [ [ row["name"], :character, row["id"], false ] ]
      end
      rows += CharacterCatalog::FRANCHISES.values.flat_map do |row|
        row["aliases"].map { |item| [ item["text"], :franchise, row["id"], item["ambiguous"] ] } + [ [ row["name"], :franchise, row["id"], false ] ]
      end
      rows += CharacterCatalog::GOODS_TYPES.values.flat_map do |row|
        (row["synonyms"] + [ row["name"] ]).map { |text| [ text, :goods, row["id"], false ] }
      end
      rows.map { |text, kind, id, ambiguous| [ fold(normalize(text)), normalize(text), kind, id, ambiguous ] }
          .uniq { |folded, _, kind, id, _| [ folded, kind, id ] }
          .sort_by { |folded, *| -folded.length }
    end
  end

  def self.call(query, user_id: nil, llm: true)
    result = dictionary(query)
    return result if result.characters.any? || result.franchises.any? || !llm || !llm_candidate?(query, result)

    interpret_with_llm(query, user_id:) || result
  end

  def self.dictionary(query)
    original = normalize(query)
    folded = fold(original)
    claimed = Array.new(folded.length, false)
    found = []
    entries.each do |text, source_text, kind, id, ambiguous|
      start = 0
      while (index = folded.index(text, start))
        range = index...(index + text.length)
        start = index + 1
        next if range.any? { |position| claimed[position] }
        next unless boundary?(original, range, source_text, ambiguous)

        range.each { |position| claimed[position] = true }
        found << { kind:, id:, ambiguous: }
      end
    end
    clues = found.any? { |match| match[:kind] != :character || !match[:ambiguous] }
    characters = found.select { |match| match[:kind] == :character && (clues || !match[:ambiguous]) }.map { |match| match[:id] }.uniq
    franchises = found.select { |match| match[:kind] == :franchise }.map { |match| match[:id] }.uniq
    goods = found.select { |match| match[:kind] == :goods }.map { |match| match[:id] }.uniq
    build(characters:, franchises:, goods_types: goods, source: "dictionary")
  end

  # 一般のインテリアと重なる種別 (クッションなど) は、キャラクターかフランチャイズがあるときだけ残す。
  def self.build(characters:, franchises:, goods_types:, source:)
    branded = characters.any? || franchises.any?
    goods_types = goods_types.select { |id| branded || CharacterCatalog.goods_type(id)["standalone"] }
    return EMPTY if !branded && goods_types.empty?

    Result.new(characters:, franchises:, goods_types:, source:)
  end

  # 英字は単語の境界で区切る。曖昧な別名は、同じ文字種の語の一部 (ミクロファイバー、船長室) や
  # 形容 (プリン型) なら一致させない。
  def self.boundary?(original, range, source_text, ambiguous)
    before = range.begin.positive? ? original[range.begin - 1] : ""
    after = original[range.end].to_s
    if source_text.match?(/\A[a-z0-9 .'-]+\z/)
      return false if before.match?(LATIN) || after.match?(LATIN)
    end
    return true unless ambiguous

    matched = original[range]
    return false if matched.match?(/\A#{KATAKANA.source}+\z/o) && (before.match?(KATAKANA) || after.match?(KATAKANA))
    return false if matched.match?(KANJI) && (before.match?(KANJI) || after.match?(KANJI))

    !original[range.end..].to_s.match?(DESCRIPTIVE_SUFFIX)
  end

  # 辞書で何も分からず、グッズを探していそうな検索語だけ Gemini に回す。
  # グッズの語 (グッズ・推しなど)、または単独で使えるグッズ種別と辞書に無いカタカナの名前が並ぶ場合。
  def self.llm_candidate?(query, result)
    folded = fold(normalize(query))
    return true if folded.match?(FAN_WORDS)
    return false if result.goods_types.empty?

    remainder = folded.dup
    result.goods_types.flat_map { |id| [ CharacterCatalog.goods_type(id)["name"], *CharacterCatalog.goods_type(id)["synonyms"] ] }
          .map { |text| fold(normalize(text)) }.sort_by { |text| -text.length }
          .each { |text| remainder = remainder.gsub(text, " ") }
    remainder.match?(/[\p{Katakana}ー]{2,}/)
  end

  def self.interpret_with_llm(query, user_id:)
    return unless GeminiClient.configured?(user_id:)

    json = GeminiClient.new.generate_json(prompt: llm_prompt(query), schema: llm_schema).json
    pick = ->(key, table) { Array(json[key]).map(&:to_s).select { |id| table.key?(id) }.uniq }
    result = build(characters: pick.call("characters", CharacterCatalog::CHARACTERS),
                   franchises: pick.call("franchises", CharacterCatalog::FRANCHISES),
                   goods_types: pick.call("goods_types", CharacterCatalog::GOODS_TYPES), source: "llm")
    result.goods_search? ? result : nil
  rescue GeminiClient::Error, ArgumentError => error
    Rails.logger.info("CharacterQuery LLM fallback skipped: #{error.message}")
    nil
  end

  def self.llm_prompt(query)
    characters = CharacterCatalog::CHARACTERS.values.map { |row| "#{row['id']}: #{row['name']} (#{row['name_en']})" }
    goods = CharacterCatalog::GOODS_TYPES.values.map { |row| "#{row['id']}: #{row['synonyms'].join('、')}" }
    <<~PROMPT
      推し活グッズの検索語を、下の辞書のIDだけで解釈してください。
      辞書にないキャラクターや、確信のない対応は空の配列にしてください。家具や色・柄の説明はキャラクターではありません。
      検索語: #{query.to_s.first(200)}
      キャラクター: #{characters.join(' / ')}
      フランチャイズ: #{CharacterCatalog::FRANCHISES.values.map { |row| "#{row['id']}: #{row['name']}" }.join(' / ')}
      グッズ種別: #{goods.join(' / ')}
    PROMPT
  end

  def self.llm_schema
    list = ->(ids) { { type: "array", items: { type: "string", enum: ids } } }
    { type: "object",
      properties: { characters: list.call(CharacterCatalog::CHARACTERS.keys), franchises: list.call(CharacterCatalog::FRANCHISES.keys),
                    goods_types: list.call(CharacterCatalog::GOODS_TYPES.keys) },
      required: %w[characters franchises goods_types] }
  end
  private_class_method :entries, :build, :boundary?, :llm_candidate?, :interpret_with_llm, :llm_prompt, :llm_schema
end
