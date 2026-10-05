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
    references = objects.filter_map { |object| binding_reference(object) if replaceable_url?(object["model_url"]) }
    if references.empty?
      fill_by_category(objects, base)
      return resolved
    end

    existing = references.select { |kind, _| kind == "existing" }.map(&:last)
    products = references.select { |kind, _| kind == "product" }.map(&:last)
    bindings = FurnitureModelBinding.where(kind: "existing", reference: existing)
      .or(FurnitureModelBinding.where(kind: "product", reference: products))
      .joins(:furniture_model).merge(FurnitureModel.available).includes(:furniture_model)
      .index_by { |binding| [ binding.kind, binding.reference ] }

    objects.each do |object|
      next unless replaceable_url?(object["model_url"])

      binding = bindings[binding_reference(object)]
      object["model_url"] = model_url(binding.furniture_model, base: base) if binding
    end
    fill_by_category(objects, base)
    resolved
  end

  # 対応表に無い家具・商品は、カテゴリ (または形の種類) が同じモデルのうち大きさが一番近いものを使う。
  # 写真の解析で出てくる chair-1・shelf-2 などや、対応表に載る前の商品にもモデルを付けるため
  def self.fill_by_category(objects, base)
    missing = objects.select { |object| replaceable_url?(object["model_url"]) && object["category"].present? }
    return if missing.empty?

    categories = missing.map { |object| object["category"] }.uniq
    models = FurnitureModel.available.where(category: categories).or(FurnitureModel.available.where(shape: categories)).to_a
    missing.each do |object|
      candidates = models.select { |model| model.category == object["category"] || model.shape == object["category"] }
      best = candidates.min_by { |model| size_distance(model, object["size"]) }
      object["model_url"] = model_url(best, base: base) if best
    end
  end
  private_class_method :fill_by_category

  # 幅・高さ・奥行きの比率のずれ (倍率の対数の絶対値) の合計。大きさを測れなければ 0 (どれでもよい)
  def self.size_distance(model, size)
    return 0 unless size.is_a?(Hash)

    [ [ model.width, size["w"] ], [ model.height, size["h"] ], [ model.depth, size["d"] ] ].sum do |model_value, value|
      value.to_f.positive? ? Math.log(model_value.to_f / value.to_f).abs : 0
    end
  end
  private_class_method :size_distance

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
