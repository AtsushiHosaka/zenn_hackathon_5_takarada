module FurnitureCandidates
  # DB の furniture_details から候補を返す。枠ごとに position 順。theme を渡すとそのテーマの商品だけに絞る (モック用)。
  # ユーザーが選んだ候補 (selected) は先頭に混ぜる。AI が後の指示で外す・入れ替えることはできる
  class Client
    def self.item(detail)
      Item.build(
        id: detail.id, slot: detail.slot, category: detail.category, name: detail.name, price: detail.price,
        shop: detail.shop, url: detail.url, image_url: detail.image_url, color: detail.symbolic_color, size: detail.size,
        metadata: detail.metadata.merge("furniture_detail_id" => detail.id, "furniture_id" => detail.furniture_id, "color_materials" => detail.color_materials,
                                        "texture_materials" => detail.detail_textures.to_h { |texture| [ texture.material_key, texture.furniture_texture.texture_key ] })
      )
    end

    def self.find_item(id)
      detail = id.is_a?(Integer) && FurnitureDetail.available.joins(:furniture).merge(Furniture.available).includes(detail_textures: :furniture_texture).find_by(id:)
      detail && item(detail)
    end

    def initialize(selected: [])
      @selected = selected
    end

    def search(slots:, max_price:, theme: nil, categories: nil, **)
      slots = Array(slots).map(&:to_s)
      categories = Array(categories).map(&:to_s)
      max_price ||= Float::INFINITY
      scope = FurnitureDetail.available.joins(:furniture).merge(Furniture.available).includes(detail_textures: :furniture_texture)
        .where(slot: slots).where(price: ..max_price).order(:position, :id)
      scope = scope.where("furniture_details.themes @> ?", [ theme ].to_json) if theme
      scope = scope.where.not(slot: "floor").or(scope.where(category: categories)) if categories.any?
      selected = @selected.select do |item|
        slots.include?(item.slot) && item.price <= max_price && (item.slot != "floor" || categories.empty? || categories.include?(item.category))
      end
      (selected + scope.map { |detail| self.class.item(detail) }).uniq { |item| [ item.metadata["group_id"], item.id ] }.group_by(&:slot)
    end
  end
end
