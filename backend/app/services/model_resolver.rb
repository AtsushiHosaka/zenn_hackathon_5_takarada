# シーンの model_url は DB カタログを優先し、未対応のものだけ既存 YAML で補う。
# 載っていないものは null のままで、クライアントが category と size から箱で描く。
class ModelResolver
  def self.call(scene)
    new.call(scene)
  end

  def call(scene)
    resolved = FurnitureModelCatalog.enrich_scene(scene)
    return nil if resolved.nil?

    resolved.merge("objects" => resolved.fetch("objects", []).map { |object| resolve(object) })
  end

  private

  def resolve(object)
    return object.merge("model_url" => nil) if object["texture_status"] == "unmatched"

    url = object["model_url"]
    # 旧フロント同梱モデルがDBで解決できなければ、補完または簡易形状へ戻す。
    object = object.merge("model_url" => nil) if url.is_a?(String) && url.start_with?("/models/furniture/")
    return object if object["model_url"].present?

    asset = key_for(object)&.then { |key| Storage.asset(ENV["MODELS_BUCKET"], key) }
    asset ? object.merge("model_url" => asset.url) : object
  end

  # 商品専用モデルを優先し、無ければカテゴリ別の汎用モデル
  def key_for(object)
    items[object["item_id"].to_s] || categories[object["category"]]
  end

  # yml の 1042: は Integer キーになるので文字列に寄せる
  def items
    @items ||= (config["items"] || {}).transform_keys(&:to_s)
  end

  def categories
    config["categories"] || {}
  end

  def config
    @config ||= YAML.load_file(Rails.root.join("config/models.yml")) || {}
  end
end
