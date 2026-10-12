module FurnitureCandidates
  # DB の furniture_details から候補を返す。枠ごとに position 順。theme を渡すとそのテーマの商品だけに絞る (モック用)。
  # ユーザーが選んだ候補 (selected) は先頭に混ぜる。AI が後の指示で外す・入れ替えることはできる
  class Client
    def self.item(detail)
      Item.build(
        id: detail.id, slot: detail.slot, category: detail.category, name: detail.name, price: detail.price,
        shop: detail.shop, url: detail.url, image_url: detail.image_url, color: detail.symbolic_color, size: detail.size,
        metadata: detail.product_metadata.merge("furniture_detail_id" => detail.id, "furniture_id" => detail.furniture_id,
                                        "characters" => detail.furniture.characters.map(&:character_key), "color_materials" => detail.color_materials,
                                        "texture_materials" => detail.detail_textures.to_h { |texture| [ texture.material_key, texture.furniture_texture.texture_key ] })
      )
    end

    def self.find_item(id)
      detail = id.is_a?(Integer) && FurnitureDetail.available.joins(:furniture).merge(Furniture.available).preload(furniture: [ :model, :characters ]).includes(detail_textures: :furniture_texture).find_by(id:)
      detail && item(detail)
    end

    def initialize(selected: [], characters: nil)
      @selected = selected.map { |item| item.with(metadata: item.metadata.merge("selected_by_user" => true)) }
      @characters = characters
    end

    def search(slots:, theme: nil, categories: nil, preference: nil, character_theme: nil, prompt: nil, **)
      slots = Array(slots).map(&:to_s)
      categories = Array(categories).map(&:to_s)
      scope = FurnitureDetail.available.joins(:furniture).merge(Furniture.available).preload(furniture: [ :model, :characters ]).includes(detail_textures: :furniture_texture)
        .where(slot: slots).order(:position, :id)
      scope = scope.where("furniture_details.themes @> ?", [ theme ].to_json) if theme
      scope = scope.where.not(slot: "floor").or(scope.where(category: categories)) if categories.any?
      if @characters
        wanted = CharacterGoods.where(character_id: Character.where(character_key: @characters).select(:id)).select(:furniture_id)
        scope = scope.where.not(furniture_id: CharacterGoods.select(:furniture_id)).or(scope.where(furniture_id: wanted))
      end
      selected = @selected.select do |item|
        slots.include?(item.slot) && (item.slot != "floor" || categories.empty? || categories.include?(item.category))
      end
      items = scope.map { |detail| self.class.item(detail) }
      items = items.select { |item| FurnitureCandidates.compatible_character?(item, character_theme) }
      items = FurnitureCandidates.rank(items, preference:, character_theme:) if preference || character_theme
      color_preference = ColorPreference.new(prompt)
      items = color_preference.sort(items).reject { |item| color_preference.rank(item) == 4 }
      (selected + items).uniq { |item| [ item.metadata["group_id"], item.id ] }.group_by(&:slot)
    end
  end
end
