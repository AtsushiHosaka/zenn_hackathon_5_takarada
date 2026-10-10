class FurnitureModelSerializer
  include Alba::Resource

  attributes :name, :category, :shape, :variant, :format, :object_key,
             :triangle_count, :byte_size, :sha256, :materials
  attribute(:id) { |model| model.model_key }
  attribute(:size) { |model| { w: model.width.to_f, h: model.height.to_f, d: model.depth.to_f } }
  attribute(:unit) { Furniture::UNIT }
  attribute(:axes) { Furniture::AXES }
  attribute(:model_url) { |model| FurnitureModelCatalog.model_url(model, base: model_base_url) }
  has_many :bindings, resource: FurnitureModelBindingSerializer

  private

  def model_base_url
    return @model_base_url if defined?(@model_base_url)

    @model_base_url = FurnitureModelCatalog.base_url
  end
end
