# Catalogue copied to the frontend domain so each deployment remains self-contained.
class RoomPalette
  CATALOGUE = JSON.parse(Rails.root.join("config/room_palettes.json").read).index_by { |palette| palette.fetch("id") }.freeze

  def self.find(id)
    CATALOGUE[id]
  end

  def self.prompt(prompt, id)
    palette = find(id)
    return prompt unless palette

    "#{prompt}\n部屋のカラーテーマは#{palette.fetch('name')}。ベース色#{palette.fetch('base')}、サブ色#{palette.fetch('secondary')}、アクセント色#{palette.fetch('accent')}を優先し、この配色に合う商品を選んでください。実商品の色は変更しません。"
  end
end
