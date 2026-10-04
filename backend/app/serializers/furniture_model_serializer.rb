class FurnitureModelSerializer
  include Alba::Resource

  attributes :name, :category, :shape, :variant, :format, :object_key,
             :triangle_count, :byte_size, :sha256, :materials
  attribute(:id) { |model| model.key }
  attribute(:size) { |model| { w: model.width.to_f, h: model.height.to_f, d: model.depth.to_f } }
  attribute(:unit) { FurnitureModel::UNIT }
  attribute(:axes) { FurnitureModel::AXES }
  attribute(:model_url) { |model| FurnitureModelCatalog.model_url(model) }
  has_many :bindings, resource: FurnitureModelBindingSerializer
end
