class FurnitureDetail < ApplicationRecord
  belongs_to :furniture, inverse_of: :details
  has_many :detail_textures, class_name: "FurnitureDetailTexture", dependent: :delete_all, inverse_of: :furniture_detail

  # 提案・検索に出す detail。管理画面で非表示にしたものを除く
  scope :available, -> { where(enabled: true) }

  validates :key, presence: true, uniqueness: true
  validates :name, :category, :shop, :url, presence: true
  validates :slot, inclusion: { in: FurnitureCandidates::SLOTS }
  validates :symbolic_color, format: { with: /\A#[0-9a-f]{6}\z/i }
  validates :price, numericality: { only_integer: true, greater_than: 0 }
  validates :width, :height, :depth, numericality: { greater_than: 0 }
  validates :enabled, inclusion: { in: [ true, false ] }
  validate :valid_themes
  validate :valid_color_materials

  normalizes :material, with: ->(value) { value.to_s.strip.presence }

  def size
    # A cover's published length belongs to depth. Its preview thickness is estimated,
    # including older imported rows that incorrectly stored that length as height.
    { "w" => width.to_f, "h" => category == "bed_cover" ? FurnitureCandidates::DEFAULT_SIZES.fetch("bed_cover").fetch("h") : height.to_f, "d" => depth.to_f }
  end

  # モデルの推定寸法に加え、カバーの描画用の厚みは推定として扱う。
  def estimated_axes
    axes = furniture.model&.estimated_axes || []
    category == "bed_cover" ? (axes + [ "h" ]).uniq : axes
  end

  # 公開されている寸法。推定した辺は nil。3 辺とも推定なら nil (寸法は目安で、配置は部屋に合わせる)
  def published_size
    published = Furniture3DModel::SIZE_AXES - estimated_axes
    size.to_h { |axis, value| [ axis, published.include?(axis) ? value : nil ] } if published.any?
  end

  # 提案・シーンの家具に載せる商品の補足。配置 (SlotLayout)・AI への商品情報・画面の商品寸法の表示が読む。
  # 形と推定した辺は商品ではなく家具の 3D モデルが持つ (chair_office, rug_round など)。同じモデルの商品は同じ形になる
  def product_metadata
    { "size" => published_size, "estimated_axes" => estimated_axes, "material" => material, "shape" => furniture.model&.shape,
      "color_name" => color_name.presence, "themes" => themes.presence }.compact
  end

  # シーンの家具・検索結果に載せる商品とモデルの情報。寸法は商品、形は家具のモデルを使う
  def scene_attributes
    model = furniture.model if furniture.enabled?
    model_url = model&.url
    {
      "furniture_detail_id" => id, "label" => name, "category" => category, "color" => symbolic_color, "color_materials" => color_materials, "size" => size,
      "price" => price, "shop" => shop, "url" => url, "image_url" => image_url, "product_metadata" => product_metadata,
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
    errors.add(:themes, "must be a list of #{FurnitureCandidates::THEMES.keys.join(', ')}") unless themes.is_a?(Array) && (themes - FurnitureCandidates::THEMES.keys).empty?
  end
end
