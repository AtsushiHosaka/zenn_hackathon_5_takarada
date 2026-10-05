module InteriorLinks
  # 商品1件。実ECの未掲載寸法はProductParserが推定し、取得値とは別に記録する。
  Item = Data.define(:id, :slot, :category, :name, :price, :shop, :url, :image_url, :color, :size, :metadata) do
    def self.build(size: nil, metadata: {}, **attrs)
      size = size&.to_h&.transform_keys(&:to_s)&.transform_values(&:to_f)
      new(size: size.presence || DEFAULT_SIZES.fetch(attrs[:category], FALLBACK_SIZE), metadata:, **attrs)
    end
  end
end
