class CharacterRoomTheme
  CATALOGUE = JSON.parse(File.read(Rails.root.join("config/character_themes.json"))).index_by { |theme| theme.fetch("id") }.freeze
  PALETTE_COLORS = {
    "snow-graphite" => %w[white gray], "stone-gray" => %w[gray], "warm-ivory" => %w[beige], "coffee-cream" => %w[brown],
    "sage-clay" => %w[green], "mint-cloud" => %w[green cyan], "midnight-brass" => %w[blue black],
    "lavender-milk" => %w[purple], "blush-linen" => %w[pink], "brick-cream" => %w[red],
    "apricot" => %w[orange], "butter-yellow" => %w[yellow], "charcoal-silver" => %w[black gray]
  }.freeze
  FAMILY_COLORS = {
    "White & gray" => %w[white gray], "Warm neutrals" => %w[beige brown], "Earth & natural" => %w[green brown],
    "Green & teal" => %w[cyan green], "Purple" => %w[purple], "Pink" => %w[pink],
    "Red, orange & yellow" => %w[red orange yellow], "Dark & moody" => %w[black gray]
  }.freeze

  def self.find(id)
    CATALOGUE[id]
  end

  # Character affinity is a room direction, never an exclusive merchandise filter.
  # Blue palettes keep Miku's cyan/blue accents; other chosen palettes take precedence.
  def self.suggestion_profile(id, palette_id: nil)
    return unless id == "hatsune-miku"

    palette = RoomPalette.find(palette_id)
    colors = PALETTE_COLORS[palette_id] || FAMILY_COLORS[palette&.fetch("family", nil)] || %w[cyan blue]
    { "id" => id, "character_keys" => [ "hatsune_miku" ], "colors" => colors,
      "neutral_colors" => %w[white gray black], "default_colors" => %w[cyan blue] }
  end

  def self.prompt(prompt, id)
    theme = find(id)
    return prompt unless theme

    direction = "#{prompt}\nキャラクターテーマ: #{theme.fetch('name')}。#{theme.fetch('instructions')}\n配色の目安: ベース色#{theme.fetch('base')}、サブ色#{theme.fetch('secondary')}、アクセント色#{theme.fetch('accent')}。\nキャラクターをイメージしたインテリアを選ぶ。公式画像や公式商品があると断定しない。部屋のカラーテーマが指定されている場合は、その配色を優先する。"
    return direction unless id == "hatsune-miku"

    "#{direction}\n初音ミクの部屋は、キャラクター商品だけで構成しない。シアン・ターコイズ・ブルーの通常の家具や布小物を色の軸にし、白・グレー・黒の実用的な家具を合わせる。ミクのグッズは飾り棚やデスク周りのアクセントとして選ぶ。ユーザーが別の色を指定した場合は、その色を優先する。実商品の色名・商品名・寸法と用途を確かめ、3Dの色を変えて希望の色の商品があるように見せない。登録候補に希望の色の商品がなければ、その不足と選んだ代替色を説明する。"
  end
end
