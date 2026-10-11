require "json"

# 家具と 3D モデル (furnitures / furniture_3d_models) を検証してから入れる。
# 1 件ごとに家具と 3D モデルを 1 つずつ作り、characters からキャラクターとの対応 (character_goods) を作る。
# キャラクターは先に CharacterImporter で入れておく。GLB のアップロードは行わない。
#
# 3D モデルは DB が正。db/furnitures.json は空の DB に入れる初期データで、furnitures に 1 件でもあれば何もしない。
# force: true のときだけ JSON で上書きする。モデルの追加・更新は管理 API (upsert) で 1 件ずつ行う。
class FurnitureImporter
  class InvalidManifest < StandardError; end

  def self.call(path = Rails.root.join("db/furnitures.json"), force: false)
    return { models: 0, skipped: true } if !force && Furniture.exists?

    new(JSON.parse(File.read(path))).call.merge(skipped: false)
  rescue JSON::ParserError => error
    raise InvalidManifest, "Invalid JSON: #{error.message}"
  end

  # 1 件 (db/furnitures.json の models[] と同じ形) を入れる。無ければ作り、あれば上書きする
  def self.upsert(model)
    new(nil).upsert(model)
  end

  def initialize(manifest)
    @manifest = manifest
  end

  def call
    models = validate_manifest

    characters = Character.includes(:franchise).index_by(&:character_key)
    Furniture.transaction do
      models.each { |attributes| save(attributes, characters) }
    end

    { models: models.length }
  end

  def upsert(model)
    attributes = validate_model(model, "model")
    Furniture.transaction { save(attributes, Character.includes(:franchise).index_by(&:character_key)) }
  end

  private

  def save(attributes, characters)
    model = Furniture3DModel.find_by(model_key: attributes.fetch(:model_key)) || Furniture3DModel.new(furniture: Furniture.new)
    model.furniture.update!(attributes.slice(:name, :category))
    model.update!(attributes.except(:name, :category, :characters))
    link_characters(model, attributes.fetch(:characters), characters)
    model
  end

  def validate_manifest
    check(@manifest.is_a?(Hash), "manifest must be an object")
    check(@manifest["unit"] == Furniture3DModel::UNIT, "unit must be #{Furniture3DModel::UNIT}")
    check(@manifest["axes"] == Furniture3DModel::AXES, "axes must be #{Furniture3DModel::AXES}")
    check(@manifest["models"].is_a?(Array), "models must be an array")

    models = @manifest.fetch("models").map.with_index { |model, index| validate_model(model, "models[#{index}]") }
    keys = models.map { |model| model.fetch(:model_key) }
    check(keys.uniq.length == keys.length, "model IDs must be unique")
    models
  end

  def validate_model(model, label)
    check(model.is_a?(Hash), "#{label} must be an object")
    %w[id name category shape format object_key sha256].each do |key|
      check(model[key].is_a?(String) && model[key].present?, "#{label}.#{key} must be a nonempty string")
    end
    check(model["id"].match?(Furniture3DModel::KEY_PATTERN), "#{label}.id must be a stable filename key")
    check(model["format"] == "glb", "#{label}.format must be glb")
    check(model["object_key"] == Furniture3DModel.object_key_for(model["id"]), "#{label}.object_key must be #{Furniture3DModel.object_key_for(model['id'])}")
    check(model["sha256"].match?(/\A[0-9a-f]{64}\z/), "#{label}.sha256 must be 64 lowercase hex characters")
    check(model["variant"].nil? || model["variant"].is_a?(String), "#{label}.variant must be a string or null")
    size = model["size"]
    check(size.is_a?(Array) && size.length == 3, "#{label}.size must be [width, height, depth]")
    check(size.all? { |value| value.is_a?(Numeric) && value.to_f.finite? && value >= 0.000001 && value <= 9999.999999 }, "#{label}.size values must be positive meters within database precision")
    check(model["triangles"].is_a?(Integer) && model["triangles"].between?(0, 2_147_483_647), "#{label}.triangles must be a nonnegative 32-bit integer")
    check(model["bytes"].is_a?(Integer) && model["bytes"].between?(1, 9_223_372_036_854_775_807), "#{label}.bytes must be a positive 64-bit integer")
    check(model["color_material_keys"].is_a?(Array) && model["color_material_keys"].all? { |key| key.is_a?(String) }, "#{label}.color_material_keys must be an array of strings")
    characters = model.fetch("characters", [])
    check(characters.is_a?(Array) && characters.all? { |key| key.is_a?(String) } && characters.uniq == characters, "#{label}.characters must be unique character keys")
    check(characters.empty? || GoodsCategories.find(model["category"]), "#{label}.category must be a goods category in config/goods_categories.json when characters are set")

    {
      model_key: model.fetch("id"), name: model.fetch("name"), category: model.fetch("category"),
      shape: model.fetch("shape"), variant: model["variant"], format: model.fetch("format"),
      width: size[0], height: size[1], depth: size[2],
      triangle_count: model.fetch("triangles"), byte_size: model.fetch("bytes"),
      sha256: model.fetch("sha256"), color_material_keys: model.fetch("color_material_keys"), characters:
    }
  end

  def link_characters(model, keys, characters)
    wanted = keys.map do |key|
      characters[key] or raise InvalidManifest, "#{model.model_key}.characters #{key.inspect} is not imported (run character:import first)"
    end
    model.furniture.character_goods.where.not(character: wanted).delete_all
    wanted.each { |character| model.furniture.character_goods.find_or_create_by!(character:) }
  rescue ActiveRecord::RecordInvalid => error
    raise InvalidManifest, "#{model.model_key}.characters: #{error.record.errors.full_messages.join(', ')}"
  end

  def check(condition, message)
    raise InvalidManifest, message unless condition
  end
end
