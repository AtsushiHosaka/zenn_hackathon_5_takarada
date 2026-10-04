module InteriorLinks
  # 商品 1 件。size は 3D の縮尺と配置に必須なので、取れなかった商品はカテゴリの標準寸法で補う
  Item = Data.define(:id, :slot, :category, :name, :price, :shop, :url, :image_url, :color, :size) do
    def self.build(size: nil, **attrs)
      size = size&.to_h&.transform_keys(&:to_s)&.transform_values(&:to_f)
      new(size: size.presence || DEFAULT_SIZES.fetch(attrs[:category], FALLBACK_SIZE), **attrs)
    end
  end
end
