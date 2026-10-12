module FurnitureCandidates
  # DB の furniture_details から候補を返す。枠ごとに position 順。theme を渡すとそのテーマの商品だけに絞る (モック用)。
  # ユーザーが選んだ候補 (selected) は先頭に混ぜる。AI が後の指示で外す・入れ替えることはできる
  class Client
    attr_reader :unavailable_color_slots
    def self.item(detail)
      Item.build(
        id: detail.id, slot: detail.slot, category: detail.category, name: detail.name, price: detail.price,
        shop: detail.shop, url: detail.url, image_url: detail.image_url, color: detail.symbolic_color, size: detail.size,
        metadata: detail.product_metadata.merge("furniture_detail_id" => detail.id, "furniture_id" => detail.furniture_id,
                                        "characters" => detail.furniture.characters.map(&:character_key), "color_materials" => detail.color_materials,
                                        "retail_family_identity" => detail.retail_family_identity, "retail_variant_available" => detail.retail_variant_available?,
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
      @resolved_selected = {}
      @unavailable_color_slots = []
    end

    def resolved_selection(item)
      @resolved_selected.fetch([ item.id, item.metadata["group_id"] ], item)
    end

    def search(slots:, theme: nil, categories: nil, preference: nil, character_theme: nil, **)
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
      if character_theme
        # Resolve the color within a proven retail family before comparing furniture.
        # Never infer a shop family from a shared 3D model or rewrite a SKU's color.
        selected = selected.filter_map do |item|
          family = item.metadata["retail_family_identity"]
          alternatives = family ? items.select { |candidate| candidate.metadata["retail_family_identity"] == family } : [ item ]
          matching = alternatives.select { |candidate| FurnitureCandidates.theme_color_eligible?(candidate, preference, character_theme) }
          choice = matching.find { |candidate| candidate.id == item.id } || FurnitureCandidates.rank(matching, preference:, character_theme:).first
          choice = choice&.with(metadata: choice.metadata.merge(item.metadata.slice("group_id", "replaces_object_id", "preferred_position", "preferred_rotation", "target_size")).merge("selected_by_user" => true))
          @resolved_selected[[ item.id, item.metadata["group_id"] ]] = choice if choice
          choice
        end
        items = items.select { |item| FurnitureCandidates.theme_color_eligible?(item, preference, character_theme) }
        @unavailable_color_slots |= (slots - [ "floor" ]) - items.map(&:slot)
        items = FurnitureCandidates.rank(items, preference:, character_theme:).uniq { |item| item.metadata["retail_family_identity"] || [ "detail", item.id ] }
      end
      items = FurnitureCandidates.rank(items, preference:, character_theme:) if preference || character_theme
      (selected + items).uniq { |item| [ item.metadata["group_id"], item.id ] }.group_by(&:slot)
    end
  end
end
