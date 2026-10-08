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
end
