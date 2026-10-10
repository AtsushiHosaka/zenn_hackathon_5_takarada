class FurnitureSearchSerializer
  include Alba::Resource

  attributes :color, :failures, :search_entry_points
  attribute :products do |result|
    result.products.map do |item|
      { "ec_product_id" => item.id - EcProduct::PUBLIC_ID_OFFSET, "name" => item.name,
        "category" => item.category, "color" => item.color, "size" => item.size,
        "price" => item.price, "shop" => item.shop, "url" => item.url,
        "image_url" => item.image_url, "product_metadata" => item.metadata,
        "model_url" => nil, "model_match" => nil, "model_size" => nil, "model_fit" => nil }
    end
  end
  # 推し活グッズとしての解釈 (specs/character-goods/spec.md)。家具検索では空で source は none
  attribute :interpretation do |result|
    interpretation = result.interpretation
    { "characters" => interpretation.characters.map do |id|
        row = CharacterCatalog.character(id)
        { "id" => id, "name" => row["name"], "franchise" => row["franchise"] }
      end,
      "franchises" => interpretation.franchises.map { |id| { "id" => id, "name" => CharacterCatalog.franchise(id)["name"] } },
      "goods_types" => interpretation.goods_types.map { |id| { "id" => id, "name" => CharacterCatalog.goods_type(id)["name"] } },
      "source" => interpretation.source }
  end
  attribute :models do |result|
    FurnitureModelSerializer.new(result.models).serializable_hash
  end
end
