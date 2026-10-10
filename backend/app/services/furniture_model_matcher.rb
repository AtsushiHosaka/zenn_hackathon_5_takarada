# 保存済みシーンの家具に、今の家具のモデル URL を付ける (配置寸法はシーンの値を保つ)。
# モデルの無い家具には、同じカテゴリ (または形) で寸法比が一番近いモデルを付ける。
# 付けられないものは null のままで、クライアントが category と size から簡易形状で描く。
class FurnitureModelMatcher
  def self.call(scene)
    return nil if scene.nil?

    resolved = scene.deep_dup
    objects = resolved.fetch("objects", [])
    base = Furniture3DModel.asset_base_url
    fill_by_category(objects, base) if base
    # モデルが無い商品と、補えなかった旧フロント同梱モデルのパスは簡易形状で描く
    objects.each do |object|
      object["model_url"] = nil if object["texture_status"] == "unmatched" || legacy_path?(object["model_url"])
    end
    resolved
  end

  def self.fill_by_category(objects, base)
    missing = objects.select do |object|
      object["texture_status"] != "unmatched" && replaceable_url?(object["model_url"]) && object["category"].present?
    end
    return if missing.empty?

    categories = missing.map { |object| object["category"] }.uniq
    available = Furniture3DModel.joins(:furniture).merge(Furniture.available)
    models = available.where(furnitures: { category: categories }).or(available.where(shape: categories)).preload(:furniture).to_a
    missing.each do |object|
      candidates = models.select { |model| model.furniture.category == object["category"] || model.shape == object["category"] }
      best = candidates.min_by { |model| model.size_distance(object["size"]) }
      object["model_url"] = best.url(base:) if best
    end
  end
  private_class_method :fill_by_category

  # 旧フロント同梱モデルのパスは GCS のモデルに置き換える。利用者が指定した外部モデルの URL は維持する
  def self.replaceable_url?(value)
    value.nil? || legacy_path?(value)
  end
  private_class_method :replaceable_url?

  def self.legacy_path?(value)
    value.is_a?(String) && value.start_with?("/models/furniture/")
  end
  private_class_method :legacy_path?
end
