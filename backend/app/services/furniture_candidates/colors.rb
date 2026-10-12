module FurnitureCandidates
  # Filtering uses published color text, never the preview's image-derived RGB.
  module Colors
    PATTERNS = {
      "white" => /ホワイト|白|アイボリー|white|ivory/i,
      "black" => /ブラック|黒|black/i,
      "gray" => /グレー|灰|gray|grey/i,
      "brown" => /ブラウン|茶|ウォールナット|brown|walnut/i,
      "beige" => /ベージュ|ナチュラル|オーク|beige|natural|oak/i,
      "green" => /グリーン|緑|ミント|green|mint/i,
      "blue" => /ブルー|青|水色|blue/i,
      "purple" => /パープル|紫|ラベンダー|ライラック|purple|lavender|lilac/i,
      "pink" => /ピンク|pink/i,
      "red" => /レッド|赤|red/i,
      "orange" => /オレンジ|orange/i,
      "yellow" => /イエロー|黄|yellow/i
    }.freeze

    # Theme palettes may name cyan internally; public furniture search color IDs stay unchanged.
    THEME_PATTERNS = { "cyan" => /シアン|ターコイズ|ティール|青緑|\b(?:cyan|turquoise|teal)\b/i }.freeze

    def self.matches?(name, color)
      color.blank? || (PATTERNS[color] || THEME_PATTERNS[color])&.match?(name.to_s) || false
    end

    # 色相 (度) の上限と色名。明るい・暗いときの呼び名は LIGHT / DARK
    HUES = [ [ 15, "赤" ], [ 45, "オレンジ" ], [ 70, "黄" ], [ 165, "緑" ], [ 200, "青緑" ], [ 250, "青" ], [ 290, "紫" ], [ 345, "ピンク" ], [ 360, "赤" ] ].freeze
    LIGHT = { "赤" => "ピンク", "オレンジ" => "薄いオレンジ", "黄" => "クリーム", "緑" => "薄緑", "青緑" => "水色", "青" => "水色", "紫" => "薄紫", "ピンク" => "薄ピンク" }.freeze
    DARK = { "赤" => "えんじ", "オレンジ" => "茶", "黄" => "カーキ", "緑" => "深緑", "青緑" => "深緑", "青" => "紺", "紫" => "濃い紫", "ピンク" => "赤紫" }.freeze

    # 代表色 (#rrggbb) のおおよその色名。AI は 16 進の色を読み違えやすいので、商品・壁・床の色を言葉でも渡す
    def self.word(hex)
      return unless hex.to_s.match?(/\A#\h{6}\z/)

      r, g, b = hex[1..].scan(/../).map { |value| value.hex / 255.0 }
      max, min = [ r, g, b ].max, [ r, g, b ].min
      lightness = (max + min) / 2
      spread = max - min # 色みの強さ
      return lightness > 0.88 ? "白" : lightness < 0.2 ? "黒" : lightness > 0.65 ? "ライトグレー" : "グレー" if spread < 0.06

      hue = (60 * (max == r ? (g - b) / spread % 6 : max == g ? (b - r) / spread + 2 : (r - g) / spread + 4)) % 360
      # くすんだ暖色は、木や生成りの色として呼ぶ
      return lightness > 0.85 ? "アイボリー" : lightness > 0.6 ? "ベージュ" : lightness > 0.3 ? "茶" : "こげ茶" if spread < 0.5 && hue.between?(15, 65)

      name = HUES.find { |limit, _| hue < limit }.last
      lightness > 0.72 ? LIGHT.fetch(name) : max < 0.52 ? DARK.fetch(name) : name
    end
  end
end
