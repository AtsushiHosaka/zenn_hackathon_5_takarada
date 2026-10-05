module InteriorLinks
  # 商品1件。モック用の標準寸法を持つ。実ECはProductParserで必要な公式寸法を確認してから渡す。
  Item = Data.define(:id, :slot, :category, :name, :price, :shop, :url, :image_url, :color, :size, :metadata) do
    def self.build(size: nil, metadata: {}, **attrs)
      size = size&.to_h&.transform_keys(&:to_s)&.transform_values(&:to_f)
      new(size: size.presence || DEFAULT_SIZES.fetch(attrs[:category], FALLBACK_SIZE), metadata:, **attrs)
    end
  end
end
