module FurnitureCandidates
  # 商品の公開色名で優先順位を付け、画像由来のRGBを実商品の色と扱わない。
  class ColorPreference
    LIGHT_BLUE = /水色|薄い青|淡い青|ライトブルー|ペールブルー|パステルブルー|スカイブルー|\b(?:light|pale|sky|pastel) blue\b/i
    CYAN = /ターコイズ|ミント|シアン|アクア|turquoise|mint|cyan|aqua/i

    PATTERNS = { "水色" => LIGHT_BLUE, "ターコイズ・ミント" => CYAN }.merge(Colors::PATTERNS).freeze

    attr_reader :name, :excluded_names

    def initialize(prompt)
      # キャラクター/パレットの補足より、ユーザー自身の色指定を優先する。
      request = prompt.to_s.split(/\n(?:キャラクターテーマ:|部屋のカラーテーマは)/).first.to_s
      @excluded_names = []
      matches = PATTERNS.flat_map do |color, pattern|
        request.to_enum(:scan, pattern).filter_map do
          match = Regexp.last_match
          next if %w[blue green].include?(color) && special_color_overlap?(request, match)

          if negated?(request, match)
            @excluded_names << color
            next
          end
          [ match.begin(0), color ]
        end
      end
      @name = matches.max_by(&:first)&.last
      @name ||= "ターコイズ・ミント" if /初音ミク|ミク|hatsune.?miku/i.match?(prompt.to_s) && !excluded_names.include?("ターコイズ・ミント")
    end

    def active?
      name.present?
    end

    def rank(item)
      text = item.metadata["official_color"].presence || item.metadata["color_name"].presence || item.name
      return 4 if excluded_names.any? { |color| PATTERNS.fetch(color).match?(text) }
      return 0 unless active?
      exact = case name
      when "水色" then LIGHT_BLUE.match?(text)
      when "ターコイズ・ミント" then CYAN.match?(text)
      else Colors.matches?(text, name)
      end
      return 0 if exact
      return 1 if [ "水色", "ターコイズ・ミント" ].include?(name) && (LIGHT_BLUE.match?(text) || CYAN.match?(text) || Colors.matches?(text, "blue"))
      return 2 if Colors.matches?(text, "white") || Colors.matches?(text, "gray")

      3
    end

    def sort(items)
      items.each_with_index.sort_by { |item, index| [ rank(item), index ] }.map(&:first)
    end

    # 水色/ミク指定は該当商品がある枠をその色で揃える。色がない枠のみ近似色/無彩色へ。
    def focused_candidates(items)
      return items unless [ "水色", "ターコイズ・ミント" ].include?(name)

      best = items.map { |item| rank(item) }.min
      best && best <= 1 ? items.select { |item| item.metadata["selected_by_user"] || Array(item.metadata["characters"]).any? || rank(item) == best } : items
    end

    private

    def special_color_overlap?(request, match)
      [ LIGHT_BLUE, CYAN ].any? do |pattern|
        request.to_enum(:scan, pattern).any? do
          special = Regexp.last_match
          special.begin(0) <= match.begin(0) && special.end(0) >= match.end(0)
        end
      end
    end

    def negated?(request, match)
      before = request[0...match.begin(0)]
      after = request[match.end(0)..]
      /\b(?:no|not|without|avoid|exclude)\s*\z/i.match?(before) ||
        /\A(?:系|色|っぽい)?(?:は|を|が)?(?:ではなく|じゃなく|以外|なし|抜き|不要|いらない|避け|使わ|使いたくない)/.match?(after)
    end
  end
end
