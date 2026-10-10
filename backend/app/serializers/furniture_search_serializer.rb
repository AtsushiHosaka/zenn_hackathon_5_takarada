class FurnitureSearchSerializer
  include Alba::Resource

  attributes :color
  attribute :products do |result|
    result.products.map do |product|
      FurnitureSearchSerializer.detail_attributes(product.detail).merge(
        "variants" => product.variants.map { |detail| FurnitureSearchSerializer.detail_attributes(detail) }
      )
    end
  end

  # 推し活グッズとしての解釈。家具検索では各一覧が空で source は none
  attribute :interpretation do |result|
    interpretation = result.interpretation
    characters = Character.includes(:franchise).where(character_key: interpretation.characters).index_by(&:character_key)
    franchises = Franchise.where(franchise_key: interpretation.franchises).index_by(&:franchise_key)
    { "characters" => interpretation.characters.filter_map { |key| (row = characters[key]) && { "id" => key, "name" => row.name, "franchise" => row.franchise.franchise_key } },
      "franchises" => interpretation.franchises.filter_map { |key| (row = franchises[key]) && { "id" => key, "name" => row.name } },
      "categories" => interpretation.categories.map { |key| { "id" => key, "name" => GoodsCategories.find(key)["name"] } },
      "source" => interpretation.source }
  end
  attribute :models do |result|
    FurnitureModelSerializer.new(result.models).serializable_hash
  end

  def self.detail_attributes(detail)
    detail.scene_attributes.except("label", "texture_status", "color")
      .merge("name" => detail.name, "furniture_id" => detail.furniture_id, "symbolic_color" => detail.symbolic_color, "color_name" => detail.color_name,
             "characters" => detail.furniture.characters.map(&:character_key), "credits" => FurnitureModelSerializer.credits(detail.furniture))
  end
end
