class FurnitureDetail < ApplicationRecord
  belongs_to :furniture, inverse_of: :details
  has_many :detail_textures, class_name: "FurnitureDetailTexture", dependent: :delete_all, inverse_of: :furniture_detail

  validates :key, presence: true, uniqueness: true
  validates :name, :category, :shop, :url, presence: true
  validates :slot, inclusion: { in: FurnitureCandidates::SLOTS }
  validates :symbolic_color, format: { with: /\A#[0-9a-f]{6}\z/i }
  validates :price, numericality: { only_integer: true, greater_than: 0 }
  validates :width, :height, :depth, numericality: { greater_than: 0 }
  validate :valid_themes
  validate :valid_color_materials

  def size
    { "w" => width.to_f, "h" => height.to_f, "d" => depth.to_f }
  end

  # シーンの家具・検索結果に載せる商品とモデルの情報。寸法は商品、形は家具のモデルを使う
  def scene_attributes
    model = furniture.model if furniture.enabled?
    model_url = model&.url
    {
      "furniture_detail_id" => id, "label" => name, "category" => category, "color" => symbolic_color, "color_materials" => color_materials, "size" => size,
      "price" => price, "shop" => shop, "url" => url, "image_url" => image_url, "product_metadata" => metadata,
      "model_url" => model_url,
      "model_match" => model && { "model_id" => model.id, "reason" => "furniture_detail", "approximate" => true },
      "model_size" => model&.size,
      "model_fit" => model ? "contain" : nil,
      "texture_status" => model_url ? "disabled" : "unmatched"
    }
  end

  private

  def valid_color_materials
    unless color_materials.is_a?(Hash) && color_materials.present? && color_materials.values.all? { |value| value.is_a?(String) && value.match?(/\A#[0-9a-f]{6}\z/i) }
      return errors.add(:color_materials, "must map part names to #rrggbb colors")
    end

    unknown = color_materials.keys - Array(furniture&.model&.color_material_keys)
    errors.add(:color_materials, "has parts the furniture does not have: #{unknown.join(', ')}") if unknown.any?
  end

  def valid_themes
    errors.add(:themes, "must be an array of strings") unless themes.is_a?(Array) && themes.all? { |theme| theme.is_a?(String) }
  end
end
