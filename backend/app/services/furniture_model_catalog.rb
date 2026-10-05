require "uri"

# 保存済みシーンにも最新のカタログを適用する。配置寸法はシーンの値を保つ。
class FurnitureModelCatalog
  class ConfigurationError < StandardError; end

  def self.base_url
    value = ENV["FURNITURE_MODEL_BASE_URL"]
    if value.blank?
      bucket = ENV["MODELS_BUCKET"]
      return nil if bucket.blank?

      unless bucket.match?(/\A[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]\z/)
        raise ConfigurationError, "MODELS_BUCKET must be a GCS bucket name"
      end
      value = "https://storage.googleapis.com/#{bucket}"
    end

    uri = URI.parse(value)
    unless uri.is_a?(URI::HTTPS) && uri.host.present? && uri.userinfo.nil? && uri.query.nil? && uri.fragment.nil?
      raise ConfigurationError, "FURNITURE_MODEL_BASE_URL must be an HTTPS base URL without credentials, query or fragment"
    end

    value.delete_suffix("/")
  rescue URI::InvalidURIError
    raise ConfigurationError, "FURNITURE_MODEL_BASE_URL is not a valid URL"
  end

  def self.model_url(model, base: base_url)
    return nil if base.nil? || !model.enabled?

    unless FurnitureModel.valid_object_key?(model.object_key)
      raise ConfigurationError, "Furniture model #{model.key} has an invalid object_key"
    end

    "#{base}/#{model.object_key.split('/').map { |segment| URI.encode_www_form_component(segment) }.join('/')}"
  end

  def self.enrich_scene(scene)
    return nil if scene.nil?

    base = base_url
    return scene if base.nil?

    resolved = scene.deep_dup
    objects = resolved.fetch("objects", [])
    references = objects.filter_map do |object|
      next if object["texture_status"] == "unmatched"

      binding_reference(object) if replaceable_url?(object["model_url"])
    end
    return resolved if references.empty?

    existing = references.select { |kind, _| kind == "existing" }.map(&:last)
    products = references.select { |kind, _| kind == "product" }.map(&:last)
    bindings = FurnitureModelBinding.where(kind: "existing", reference: existing)
      .or(FurnitureModelBinding.where(kind: "product", reference: products))
      .joins(:furniture_model).merge(FurnitureModel.available).includes(:furniture_model)
      .index_by { |binding| [ binding.kind, binding.reference ] }

    objects.each do |object|
      next if object["texture_status"] == "unmatched"
      next unless replaceable_url?(object["model_url"])

      binding = bindings[binding_reference(object)]
      object["model_url"] = model_url(binding.furniture_model, base: base) if binding
    end
    resolved
  end

  # 旧フロント同梱モデルのパスは、対応するGCSモデルへ移行する。
  # 利用者が指定した外部モデルのURLは維持する。
  def self.replaceable_url?(value)
    value.nil? || (value.is_a?(String) && value.start_with?("/models/furniture/"))
  end
  private_class_method :replaceable_url?

  def self.binding_reference(object)
    case object["source"]
    when "existing"
      [ "existing", object["id"] ] if object["id"].present?
    when "suggested"
      [ "product", object["item_id"].to_s ] if object["item_id"].present?
    end
  end
  private_class_method :binding_reference
end
