# シーンの model_url を config/models.yml から埋める。
# 載っていないものは null のままで、クライアントが category と size から箱で描く。
class ModelResolver
  def self.call(scene)
    new.call(scene)
  end

  def call(scene)
    scene.merge("objects" => scene["objects"].map { |object| resolve(object) })
  end

  private

  def resolve(object)
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
