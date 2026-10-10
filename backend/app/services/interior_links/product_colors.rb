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

    # 色名から代表色。色名がいくつ含まれるか (単色か) の判定にも使う
    NAMES = { /ホワイト|白|アイボリー/ => "#f2efe8", /ブラック|黒/ => "#303030", /グリーン|緑/ => "#799469",
               /ブルー|青/ => "#778da6", /ピンク/ => "#d6a5b3", /グレー/ => "#aaa9a5", /ブラウン|茶|ウォールナット/ => "#987b61",
               /ナチュラル|ベージュ|無垢|オーク|アッシュ/ => "#c4ae8c", /パープル|紫/ => "#ad96bb" }.freeze

    def self.matches?(name, color)
      color.blank? || PATTERNS.fetch(color).match?(name.to_s)
    end
  end
end
