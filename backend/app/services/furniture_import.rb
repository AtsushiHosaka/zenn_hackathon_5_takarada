require "timeout"

# 実際の商品ページを取得し、確認できた情報だけを所有家具として追加する。
class FurnitureImport
  DEADLINE_SECONDS = 45
  Result = Data.define(:ec_product_id, :name, :category, :color, :size, :price, :shop, :url, :image_url, :product_metadata,
                       :model_url, :model_match, :model_size, :model_fit)
  class Error < StandardError; end

  def self.call(url:, user_id:, variant_id: nil)
    unless url.is_a?(String) && url.length <= 2048 && InteriorLinks::PageFetcher.store(url.strip)
      raise Error, "商品ページのURLを確認してください"
    end

    raise Error, "商品バリエーションを確認してください" unless variant_id.nil? || variant_id.is_a?(String) && variant_id.length.between?(1, 120)

    attributes = Timeout.timeout(DEADLINE_SECONDS) do
      page = InteriorLinks::PageFetcher.new.fetch(url.strip)
      InteriorLinks::ProductParser.new(user_id: user_id).parse(**page, variant_id:)
    end
    unless Coordination::FLOOR_CATEGORIES.include?(attributes[:category])
      raise Error, "追加できる家具はソファ・ベッド・デスク・椅子・収納棚・テーブルです"
    end

    metadata = attributes.fetch(:metadata)
    product = EcProduct.create_or_find_by!(metadata.slice("provider", "provider_product_id", "variant_id")) do |record|
      record.source_url = attributes.fetch(:url)
      record.data = attributes.stringify_keys
      record.fetched_at = Time.iso8601(metadata.fetch("fetched_at"))
    end
    product.update!(source_url: attributes.fetch(:url), data: attributes.stringify_keys, fetched_at: Time.iso8601(metadata.fetch("fetched_at")))
    match_product(product)
    values = scene_attributes(product)
    Result.new(**values.slice(*Result.members.map(&:to_s)).symbolize_keys.merge(name: product.data.fetch("name")))
  rescue InteriorLinks::PageFetcher::Error, InteriorLinks::ProductParser::Unverified => error
    raise Error, error.message
  rescue Timeout::Error
    raise Error, "商品ページの取得に時間がかかっています。再度お試しください"
  end

  def self.scene_attributes(product)
    data = product.data
    binding = FurnitureModelBinding.includes(:furniture_model).find_by(kind: "product", reference: product.product_id.to_s)
    model = binding&.furniture_model
    model = nil unless model&.enabled?
    model_url = model && FurnitureModelCatalog.model_url(model)
    {
      "ec_product_id" => product.id, "label" => data.fetch("name"), "category" => data.fetch("category"),
      "color" => data.fetch("color"), "size" => data.fetch("size"), "price" => data.fetch("price"),
      "shop" => data.fetch("shop"), "url" => product.source_url, "product_metadata" => data.fetch("metadata"),
      "image_url" => data["image_url"],
      "model_url" => model_url,
      "model_match" => model && { "model_id" => model.id, "reason" => binding.match_metadata["reason"].presence || "explicit_product_binding", "approximate" => true },
      "model_size" => model && { "w" => model.width.to_f, "h" => model.height.to_f, "d" => model.depth.to_f },
      "model_fit" => model ? "contain" : nil,
      "texture_status" => model_url ? "disabled" : "unmatched"
    }
  end

  def self.match_product(product)
    FurnitureProductMatcher.call(
      item: { "item_id" => product.product_id, "category" => product.data.fetch("category"), "name" => product.data.fetch("name"), "product_metadata" => product.data.fetch("metadata") },
      object: { "size" => product.data.fetch("size") }, allow_category_approximation: true
    )
  rescue StandardError => error
    Rails.logger.warn("Furniture import model matching failed (#{error.class.name})")
  end
  private_class_method :match_product
end
