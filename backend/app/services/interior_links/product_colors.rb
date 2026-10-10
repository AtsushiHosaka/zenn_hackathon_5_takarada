module InteriorLinks
  # Filtering uses published color text, never the preview's image-derived RGB.
  module ProductColors
    PATTERNS = {
      "white" => /ホワイト|白|アイボリー|white|ivory/i,
      "black" => /ブラック|黒|black/i,
      "gray" => /グレー|灰|gray|grey/i,
      "brown" => /ブラウン|茶|ウォールナット|brown|walnut/i,
      "beige" => /ベージュ|ナチュラル|オーク|beige|natural|oak/i,
      "green" => /グリーン|緑|green/i,
      "blue" => /ブルー|青|blue/i,
      "purple" => /パープル|紫|ラベンダー|purple|lavender/i,
      "pink" => /ピンク|pink/i,
      "red" => /レッド|赤|red/i,
      "orange" => /オレンジ|orange/i,
      "yellow" => /イエロー|黄|yellow/i
    }.freeze

    def self.matches?(name, color)
      color.blank? || PATTERNS.fetch(color).match?(name.to_s)
    end
  end
end
