require "json"

# メタデータ全体を検証してから取り込む。GLB のアップロードは行わない。
class FurnitureModelImporter
  class InvalidManifest < StandardError; end

  def self.call(path = Rails.root.join("db/furniture_models.json"))
    new(JSON.parse(File.read(path))).call
  rescue JSON::ParserError => error
    raise InvalidManifest, "Invalid JSON: #{error.message}"
  end

  def initialize(manifest)
    @manifest = manifest
  end

  def call
    models, bindings = validate_manifest

    FurnitureModel.transaction do
      imported = models.to_h do |attributes|
        model = FurnitureModel.find_or_initialize_by(key: attributes.fetch(:key))
        model.update!(attributes)
        [ model.key, model ]
      end
      retained_binding_ids = bindings.map do |attributes|
        binding = FurnitureModelBinding.find_or_initialize_by(kind: attributes.fetch("kind"), reference: attributes.fetch("reference"))
        binding.update!(furniture_model: imported.fetch(attributes.fetch("model_id")), managed_by: "manifest", match_metadata: {})
        binding.id
      end
      # 対応表はmanifestを正とする。用途が外れたモデル本体の履歴は残す。
      FurnitureModelBinding.where(managed_by: "manifest").where.not(id: retained_binding_ids).delete_all
    end

    { models: models.length, bindings: bindings.length }
  end

  private

  def validate_manifest
    check(@manifest.is_a?(Hash), "manifest must be an object")
    check(@manifest["unit"] == FurnitureModel::UNIT, "unit must be #{FurnitureModel::UNIT}")
    check(@manifest["axes"] == FurnitureModel::AXES, "axes must be #{FurnitureModel::AXES}")
    check(@manifest["models"].is_a?(Array), "models must be an array")
    check(@manifest["bindings"].is_a?(Array), "bindings must be an array")

    models = @manifest.fetch("models").map.with_index { |model, index| validate_model(model, index) }
    keys = models.map { |model| model.fetch(:key) }
    check(keys.uniq.length == keys.length, "model IDs must be unique")
    bindings = @manifest.fetch("bindings").map.with_index { |binding, index| validate_binding(binding, keys, index) }
    references = bindings.map { |binding| binding.values_at("kind", "reference") }
    check(references.uniq.length == references.length, "binding kind/reference pairs must be unique")
    [ models, bindings ]
  end

  def validate_model(model, index)
    label = "models[#{index}]"
    check(model.is_a?(Hash), "#{label} must be an object")
    %w[id name category shape format object_key sha256].each do |key|
      check(model[key].is_a?(String) && model[key].present?, "#{label}.#{key} must be a nonempty string")
    end
    check(model["id"].match?(FurnitureModel::KEY_PATTERN), "#{label}.id must be a stable filename key")
    check(model["format"] == "glb", "#{label}.format must be glb")
    check(FurnitureModel.valid_object_key?(model["object_key"]), "#{label}.object_key must be a safe relative GLB path")
    check(model["sha256"].match?(/\A[0-9a-f]{64}\z/), "#{label}.sha256 must be 64 lowercase hex characters")
    check(model["variant"].nil? || model["variant"].is_a?(String), "#{label}.variant must be a string or null")
    size = model["size"]
    check(size.is_a?(Array) && size.length == 3, "#{label}.size must be [width, height, depth]")
    check(size.all? { |value| value.is_a?(Numeric) && value.to_f.finite? && value >= 0.000001 && value <= 9999.999999 }, "#{label}.size values must be positive meters within database precision")
    check(model["triangles"].is_a?(Integer) && model["triangles"].between?(0, 2_147_483_647), "#{label}.triangles must be a nonnegative 32-bit integer")
    check(model["bytes"].is_a?(Integer) && model["bytes"].between?(1, 9_223_372_036_854_775_807), "#{label}.bytes must be a positive 64-bit integer")
    check(model["materials"].is_a?(Array) && model["materials"].all? { |material| material.is_a?(String) }, "#{label}.materials must be an array of strings")
    goods_type, characters, search_terms = validate_goods(model, label)

    {
      key: model.fetch("id"), name: model.fetch("name"), category: model.fetch("category"),
      shape: model.fetch("shape"), variant: model["variant"], format: model.fetch("format"),
      object_key: model.fetch("object_key"), width: size[0], height: size[1], depth: size[2],
      triangle_count: model.fetch("triangles"), byte_size: model.fetch("bytes"),
      sha256: model.fetch("sha256"), materials: model.fetch("materials"),
      goods_type: goods_type, characters: characters, search_terms: search_terms
    }
  end

  # 推し活グッズの任意フィールド。省略時は null / [] として扱う。
  def validate_goods(model, label)
    goods_type = model["goods_type"]
    characters = model.fetch("characters", [])
    search_terms = model.fetch("search_terms", [])
    check(goods_type.nil? || CharacterCatalog.goods_type(goods_type), "#{label}.goods_type must be null or a goods_types id in config/characters.json")
    check(string_array?(characters), "#{label}.characters must be an array of strings")
    check(string_array?(search_terms), "#{label}.search_terms must be an array of strings")
    check(characters.uniq.length == characters.length, "#{label}.characters must not contain duplicates")
    characters.each do |id|
      check(CharacterCatalog.character(id), "#{label}.characters contains unknown character #{id}")
      check(CharacterCatalog.likeness_allowed?(id), "#{label}.characters contains #{id}, whose franchise does not allow character likenesses")
    end
    check(characters.empty? || goods_type, "#{label}.characters requires a goods_type")
    [ goods_type, characters, search_terms ]
  end

  def string_array?(value)
    value.is_a?(Array) && value.all? { |item| item.is_a?(String) && item.present? }
  end

  def validate_binding(binding, model_keys, index)
    label = "bindings[#{index}]"
    check(binding.is_a?(Hash), "#{label} must be an object")
    check(FurnitureModelBinding::KINDS.include?(binding["kind"]), "#{label}.kind must be existing or product")
    check(binding["reference"].is_a?(String) && binding["reference"].present?, "#{label}.reference must be a nonempty string")
    if binding["kind"] == "product"
      check(binding["reference"].match?(/\A[1-9][0-9]*\z/), "#{label}.reference must be a positive product ID")
    end
    check(model_keys.include?(binding["model_id"]), "#{label}.model_id must refer to a model in this manifest")
    binding
  end

  def check(condition, message)
    raise InvalidManifest, message unless condition
  end
end
