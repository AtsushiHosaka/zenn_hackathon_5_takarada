# 保存済みシーンの家具に、今の家具のモデル URL を付ける (配置寸法はシーンの値を保つ)。
# 写真の家具・古いコーデの商品は furniture_bindings、それ以外は同じカテゴリで寸法比が一番近いモデル。
# 付けられないものは null のままで、クライアントが category と size から簡易形状で描く。
class SceneModelResolver
  def self.call(scene)
    return nil if scene.nil?

    resolved = scene.deep_dup
    objects = resolved.fetch("objects", [])
    base = Furniture.asset_base_url
    fill_by_binding(objects, base) if base
    fill_by_category(objects, base) if base
    # モデルが無い商品と、補えなかった旧フロント同梱モデルのパスは簡易形状で描く
    objects.each do |object|
      object["model_url"] = nil if object["texture_status"] == "unmatched" || legacy_path?(object["model_url"])
    end
    resolved
  end

  # 写真の家具 ID・保存済みコーデの商品 ID は furniture_bindings の対応を使う
  def self.fill_by_binding(objects, base)
    references = objects.filter_map do |object|
      next if object["texture_status"] == "unmatched"

      binding_reference(object) if replaceable_url?(object["model_url"])
    end
    return if references.empty?

    existing = references.select { |kind, _| kind == "existing" }.map(&:last)
    products = references.select { |kind, _| kind == "product" }.map(&:last)
    bindings = FurnitureBinding.where(kind: "existing", reference: existing)
      .or(FurnitureBinding.where(kind: "product", reference: products))
      .joins(:furniture).merge(Furniture.available).includes(:furniture)
      .index_by { |binding| [ binding.kind, binding.reference ] }

    objects.each do |object|
      next if object["texture_status"] == "unmatched"
      next unless replaceable_url?(object["model_url"])

      binding = bindings[binding_reference(object)]
      object["model_url"] = binding.furniture.model_url(base:) if binding
    end
  end
  private_class_method :fill_by_binding

  # 対応表に無い家具・商品は、カテゴリ (または形の種類) が同じモデルのうち大きさが一番近いものを使う。
  # 写真の解析で出てくる chair-1・shelf-2 などや、対応表に載る前の商品にもモデルを付けるため
  def self.fill_by_category(objects, base)
    missing = objects.select do |object|
      object["texture_status"] != "unmatched" && replaceable_url?(object["model_url"]) && object["category"].present?
    end
    return if missing.empty?

    categories = missing.map { |object| object["category"] }.uniq
    models = Furniture.available.where(category: categories).or(Furniture.available.where(shape: categories)).to_a
    missing.each do |object|
      candidates = models.select { |model| model.category == object["category"] || model.shape == object["category"] }
      best = candidates.min_by { |model| size_distance(model, object["size"]) }
      object["model_url"] = best.model_url(base:) if best
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

  # 旧フロント同梱モデルのパスは GCS のモデルに置き換える。利用者が指定した外部モデルの URL は維持する
  def self.replaceable_url?(value)
    value.nil? || legacy_path?(value)
  end
  private_class_method :replaceable_url?

  def self.legacy_path?(value)
    value.is_a?(String) && value.start_with?("/models/furniture/")
  end
  private_class_method :legacy_path?

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
