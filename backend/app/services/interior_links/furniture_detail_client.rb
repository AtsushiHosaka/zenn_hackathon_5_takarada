module InteriorLinks
  # DB の furniture_details から候補を返す。外部の EC は検索しない。
  # 枠ごとに position 順。theme を渡すとそのテーマの商品だけに絞る (モック用)。
  class FurnitureDetailClient
    def self.item(detail)
      Item.build(
        id: detail.id, slot: detail.slot, category: detail.category, name: detail.name, price: detail.price,
        shop: detail.shop, url: detail.url, image_url: detail.image_url, color: detail.symbolic_color, size: detail.size,
        metadata: detail.metadata.merge("furniture_detail_id" => detail.id, "furniture_id" => detail.furniture_id, "color_materials" => detail.color_materials)
      )
    end

    def self.find_item(id)
      detail = id.is_a?(Integer) && FurnitureDetail.joins(:furniture).merge(Furniture.available).find_by(id:)
      detail && item(detail)
    end

    def search(slots:, max_price:, theme: nil, categories: nil, **)
      categories = Array(categories).map(&:to_s)
      scope = FurnitureDetail.joins(:furniture).merge(Furniture.available)
        .where(slot: Array(slots).map(&:to_s)).where(price: ..max_price).order(:position, :id)
      scope = scope.where("furniture_details.themes @> ?", [ theme ].to_json) if theme
      scope = scope.where.not(slot: "floor").or(scope.where(category: categories)) if categories.any?
      scope.map { |detail| self.class.item(detail) }.group_by(&:slot)
    end
  end
end
