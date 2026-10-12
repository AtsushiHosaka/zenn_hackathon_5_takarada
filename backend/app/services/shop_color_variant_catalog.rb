# Import a reviewed shop-colour refresh without deleting or enabling catalog rows.
# Generation still chooses only DB records; this import never guesses retail families.
class ShopColorVariantCatalog
  FIELDS = %w[name color_name price image_url url symbolic_color color_materials retail_family_key retail_variant_key retail_source_url retail_checked_at retail_availability].freeze

  def self.call(source)
    rows = source.fetch("details")
    checked_at = Time.iso8601(source["checked_at"]) if source["checked_at"].present?
    models = Furniture3DModel.includes(:furniture).where(model_key: rows.pluck("model_key")).index_by(&:model_key)
    updated = 0
    FurnitureDetail.transaction do
      rows.each do |row|
        detail = FurnitureDetail.find_by(key: row.fetch("key"))
        row_checked_at = Time.iso8601(row["retail_checked_at"]) if row["retail_checked_at"].present?
        if row_checked_at
          next unless row_checked_at.between?(30.days.ago, Time.current)
          next if detail&.retail_checked_at && detail.retail_checked_at >= row_checked_at
        elsif detail&.verified_retail_variant?
          next unless checked_at&.between?(detail.retail_checked_at, Time.current)
        end
        # A failed refresh can invalidate an old check, but cannot create a product.
        next if row["retail_checked_at"].blank? && !detail&.verified_retail_variant?
        next if detail && !detail.enabled?
        next unless (model = models[row["model_key"]]) && model.furniture&.enabled?
        next if detail && (detail.furniture_id != model.furniture_id || detail.url != row["url"])
        if detail
          next unless %w[category slot shop].all? { |field| detail.public_send(field) == row[field] }
          snapshot_size = row.fetch("size")
          next unless detail.size.all? { |axis, value| value == snapshot_size[axis].to_f }
        end

        if !detail
          size = row.fetch("size")
          detail = FurnitureDetail.new(key: row.fetch("key"), furniture: model.furniture, category: row.fetch("category"), slot: row.fetch("slot"),
                                       width: size.fetch("w"), height: size.fetch("h"), depth: size.fetch("d"), shop: row.fetch("shop"),
                                       themes: row.fetch("themes", []), material: row["material"], position: FurnitureDetail.maximum(:position).to_i + 1)
        end
        detail.assign_attributes(FIELDS.to_h { |field| [ field, row[field] ] })
        next unless detail.changed?

        fresh = detail.new_record?
        detail.save!
        if fresh
          row.fetch("texture_materials", {}).each do |material_key, texture_key|
            texture = FurnitureTexture.find_by!(texture_key:)
            detail.detail_textures.create!(furniture_texture: texture, material_key:)
          end
        end
        updated += 1
      end
    end
    updated
  end
end
