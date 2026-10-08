# Match a stable internal product ID once and retain it across manifest imports.
class FurnitureProductMatcher
  Result = Data.define(:model, :reason, :approximate)
  MAX_RATIO_ERROR = 1.2
  THIN_AXES = { "rug" => [ "h" ], "bed_cover" => [ "h" ], "curtain" => [ "d" ], "tapestry" => [ "d" ], "wall_art" => [ "d" ], "neon" => [ "d" ] }.freeze
  # Display goods whose model choice depends on the name, not on round/rectangular topology.
  NAME_SHAPED_CATEGORIES = %w[acrylic_stand_case oshi_goods display_case tapestry neon wall_shelf vase candle].freeze

  def self.call(item:, object:, allow_category_approximation: false)
    new(item, object, allow_category_approximation: allow_category_approximation).call
  end

  def initialize(item, object, allow_category_approximation: false)
    @item = item
    @object = object
    @metadata = item.fetch("product_metadata", {}).to_h
    @allow_category_approximation = allow_category_approximation
  end

  def call
    return nil unless @item["item_id"].to_s.match?(/\A[1-9][0-9]*\z/)

    binding = FurnitureModelBinding.includes(:furniture_model).find_by(kind: "product", reference: @item["item_id"].to_s)
    if binding&.furniture_model&.enabled?
      return Result.new(model: binding.furniture_model, reason: binding.match_metadata["reason"].presence || "explicit_product_binding", approximate: true)
    end
    size = @metadata["size"].presence || @object["size"]
    return nil unless size.is_a?(Hash)

    known_axes = %w[w h d].select { |axis| valid_dimension?(size[axis]) }
    estimated_axes = %w[w h d] - known_axes
    unresolved_axes = estimated_axes - THIN_AXES.fetch(@item["category"], [])
    standard_sized = false
    # Small display goods vary little in size; Yahoo! pages often omit dimensions,
    # so fill missing axes with the placed category-standard size.
    if NAME_SHAPED_CATEGORIES.include?(@item["category"]) && estimated_axes.any? &&
        estimated_axes.all? { |axis| valid_dimension?(@object.dig("size", axis)) }
      size = size.merge(estimated_axes.to_h { |axis| [ axis, @object.dig("size", axis) ] })
      known_axes = %w[w h d]
      unresolved_axes = []
      standard_sized = true
    end
    return nil if known_axes.length < 2 || unresolved_axes.any?

    # Product search uses table as an umbrella; the model catalog separates side tables.
    categories = @item["category"] == "table" ? %w[table side_table] : @item["category"]
    candidates = FurnitureModel.available.where(category: categories)
    shapes = candidate_shapes
    category_approximation = shapes.nil? && @allow_category_approximation && %w[chair shelf].include?(@item["category"])
    candidates = candidates.where(shape: shapes) unless category_approximation
    # A 6mm neon sign or tapestry differs from its model mainly in thickness; compare the face.
    face_axes = known_axes - THIN_AXES.fetch(@item["category"], [])
    ratio_axes = NAME_SHAPED_CATEGORIES.include?(@item["category"]) && face_axes.length >= 2 ? face_axes : known_axes
    scored = candidates.map { |model| [ model, ratio_error(size, model, ratio_axes) ] }
    model, error = scored.min_by { |candidate, score| [ score, candidate.variant.present? ? 1 : 0, candidate.key ] }
    # A standard size is only a guess, so the name-based candidates decide the model.
    return nil if model.nil? || (error > MAX_RATIO_ERROR && !standard_sized)

    reason = "category_shape_ratio:#{model.category}/#{model.shape};ratio_error=#{error.round(3)}"
    reason += ";shape_source=#{@metadata['shape'].present? ? 'product_metadata' : 'product_name_approximation'}"
    reason += ";category_size_approximation=true" if category_approximation
    reason += ";estimated_axes=#{estimated_axes.join(',')}" if estimated_axes.any?
    attributes = { furniture_model: model, managed_by: "ec_matcher", match_metadata: { reason: reason, approximate: true, product_variant: @metadata["variant_id"], shape: model.shape } }
    binding ||= FurnitureModelBinding.new(kind: "product", reference: @item["item_id"].to_s)
    binding.update!(attributes)
    Result.new(model: model, reason: reason, approximate: true)
  rescue ActiveRecord::RecordNotUnique
    binding = FurnitureModelBinding.includes(:furniture_model).find_by!(kind: "product", reference: @item["item_id"].to_s)
    binding.furniture_model.enabled? ? Result.new(model: binding.furniture_model, reason: "concurrent_product_binding", approximate: true) : nil
  end

  private

  def ratio_error(size, model, axes)
    dimensions = axes.map { |axis| size[axis].to_f }
    originals = { "w" => model.width.to_f, "h" => model.height.to_f, "d" => model.depth.to_f }
    model_dimensions = axes.map { |axis| originals.fetch(axis) }
    # Compare ratios independent of overall scale; fitted meshes use contain.
    ratios = dimensions.zip(model_dimensions).map { |product, original| Math.log(product / original) }
    ratios.max - ratios.min
  end

  def valid_dimension?(value)
    value.is_a?(Numeric) && value.to_f.finite? && value.positive?
  end

  def candidate_shapes
    shape = @metadata["shape"].to_s
    return inferred_shape if shape.blank? || NAME_SHAPED_CATEGORIES.include?(@item["category"])

    # Classified topology is a constraint, not an invented catalog-model ID.
    case shape
    when "round", "circular"
      { "rug" => "rug_round", "cushion" => "cushion_round", "table" => %w[table_low_round table_dining_round side_table], "side_table" => "side_table", "ottoman" => "ottoman_round" }[@item["category"]]
    when "rectangular", "rectangle", "rect"
      { "rug" => "rug_rect", "cushion" => "cushion", "bed_cover" => "bed_cover", "curtain" => inferred_shape,
        "bed" => %w[bed_single bed_semidouble bed_double], "sofa" => %w[sofa_1seat sofa_2seat sofa_3seat],
        "desk" => %w[desk_wood desk_wide], "table" => %w[table_low_rect table_dining_rect] }[@item["category"]]
    when "oval"
      { "rug" => "rug_oval", "table" => "table_low_oval" }[@item["category"]]
    when "corner", "l_shaped" then nil # The chaise side must be known.
    when "corner_left" then @item["category"] == "sofa" ? "sofa_l_left" : nil
    when "corner_right" then @item["category"] == "sofa" ? "sofa_l_right" : nil
    when "tripod" then @item["category"] == "floor_lamp" ? "floor_lamp_tripod" : nil
    when "unknown" then nil
    else shape # Catalog slug supplied by a verified parser/provider.
    end
  end

  def inferred_shape
    name = @item["name"].to_s
    case @item["category"]
    when "rug" then name.match?(/円形|丸|直径|φ/) ? "rug_round" : "rug_rect"
    when "cushion" then name.match?(/円形|丸|直径|φ/) ? "cushion_round" : "cushion"
    when "curtain" then name.match?(/レース|シアー/) ? "curtain_sheer" : "curtain_pair"
    when "sofa"
      return nil if name.match?(/カウチ|コーナー|L字/)
      return "sofa_3seat" if name.match?(/3人|三人|3シーター/)
      return "sofa_2seat" if name.match?(/2人|二人|2シーター/)
      return "sofa_1seat" if name.match?(/1人|一人|1シーター/)
      nil
    when "bed"
      return nil if name.match?(/二段|ロフト|天蓋|折りたたみ/)
      return "bed_semidouble" if name.include?("セミダブル")
      return "bed_double" if name.include?("ダブル")
      name.include?("シングル") ? "bed_single" : nil
    when "desk" then name.match?(/L字|昇降/) ? nil : "desk_wood"
    when "table"
      return nil unless name.match?(/ローテーブル|センターテーブル|ダイニング/)
      return name.include?("ダイニング") ? "table_dining_round" : "table_low_round" if name.match?(/円形|丸/)
      return nil unless name.match?(/長方形|矩形|角形/)
      name.include?("ダイニング") ? "table_dining_rect" : "table_low_rect"
    when "bed_cover" then "bed_cover"
    when "wall_shelf" then %w[shelf_floating wall_shelf wall_shelf_hex]
    when "display_case" then %w[display_case display_rack_open cabinet_glass]
    when "acrylic_stand_case" then "acrylic_stand_case"
    when "oshi_goods"
      return "uchiwa_stand" if name.include?("うちわ")
      name.include?("缶バッジ") ? "badge_display" : "acrylic_stand"
    when "neon" then "neon_sign"
    when "vase" then %w[vase_tulip dried_flowers]
    when "candle" then "candle"
    when "floor_lamp" then "floor_lamp"
    when "desk_lamp" then name.include?("クリップ") ? "desk_lamp_clip" : "desk_lamp_arm"
    when "tapestry" then "tapestry"
    else
      # No category-only choice for ambiguous structures.
      nil
    end
  end
end
