class FurnitureImportSerializer
  include Alba::Resource

  attributes :ec_product_id, :name, :category, :color, :size, :price, :shop, :url, :image_url, :product_metadata,
             :model_url, :model_match, :model_size, :model_fit
end
