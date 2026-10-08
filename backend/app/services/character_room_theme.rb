class CharacterRoomTheme
  CATALOGUE = JSON.parse(File.read(Rails.root.join("config/character_themes.json"))).index_by { |theme| theme.fetch("id") }.freeze

  def self.find(id)
    CATALOGUE[id]
  end

  def self.prompt(prompt, id)
    theme = find(id)
    return prompt unless theme

    "#{prompt}\nキャラクターテーマ: #{theme.fetch('name')}。#{theme.fetch('instructions')}\n配色の目安: ベース色#{theme.fetch('base')}、サブ色#{theme.fetch('secondary')}、アクセント色#{theme.fetch('accent')}。\nキャラクターをイメージしたインテリアを選ぶ。公式画像や公式商品があると断定しない。部屋のカラーテーマが指定されている場合は、その配色を優先する。"
  end
end
