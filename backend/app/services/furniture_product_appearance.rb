class FurnitureProductAppearance
  MAX_IMAGES = 3
  DEADLINE_SECONDS = 90
  IMAGE_COLOR_SOURCE = "product_image_dominant_color_v1".freeze
  PRIMARY_MATERIALS = %w[tint wood fabric fabric_base rattan weave leaf pot metal].freeze
  # These templates name their color-changing region differently from tint.
  SHAPE_MATERIALS = { "hanger_rack" => "metal", "floor_lamp_slim" => "light",
                      "led_strip_segment" => "light", "fairy_lights" => "light", "neon_sign" => "light" }.freeze
  PAINTED_WOOD = /(?:無垢材|合板|突き板|木材|天然木|ラバーウッド|バーチ材|パイン材)[^:。\n]{0,100}(?:塗装|ペイント)/
  CLEAR_FINISH = /透明|クリア|無色|clear|transparent/i

  def self.call(scene:, items:, user_id:)
    new(scene: scene, items: items, user_id: user_id).call
  end

  def initialize(scene:, items:, user_id:)
    @scene = scene.deep_dup
    @items = items.deep_dup
    @user_id = user_id
  end

  def call
    deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + DEADLINE_SECONDS
    by_marker = @items.index_by { |item| item["marker"] }
    @scene.fetch("objects", []).each do |object|
      next unless object["source"] == "suggested"

      item = by_marker[object["marker"]]
      next unless item && item["product_metadata"].is_a?(Hash) && item["product_metadata"].present?
      next if item.dig("product_metadata", "source") == "mock"

      begin
        match = FurnitureProductMatcher.call(item: item, object: object)
        unless match
          object["model_url"] = nil
          object["texture_status"] = item["texture_status"] = "unmatched"
          next
        end
        model = match.model
        model_match = { "model_id" => model.id, "reason" => match.reason, "approximate" => match.approximate }
        object["model_match"] = item["model_match"] = model_match
        object["model_url"] = FurnitureModelCatalog.model_url(model)
        object["model_size"] = { "w" => model.width.to_f, "h" => model.height.to_f, "d" => model.depth.to_f }
        object["model_fit"] = "contain"
        object["color"] = item["color"]
        overrides = color_overrides(item, model)
        # Apply the product color even without image generation or its dependencies.
        object["material_overrides"] = overrides if overrides.present?
        status = overrides.present? ? "ready" : "disabled"
        if !image_color?(item) && object["model_url"].present? && ENV["MODELS_BUCKET"].present? && GeminiImageClient.configured?(user_id: @user_id)
          object["texture_source"] = item["texture_source"] = "description"
          @generator ||= FurnitureTextureGenerator.new
          generated = @generator.call(item: item, model: model, max_images: MAX_IMAGES - @generator.attempts, deadline: deadline)
          overrides = overrides.merge(generated.overrides)
          status = overrides.present? ? "ready" : "skipped"
          object["material_overrides"] = overrides if overrides.present?
        end
        object["texture_status"] = item["texture_status"] = status
      rescue StandardError => error
        # Keep the selected product, placement and base color on dependency failures.
        object["texture_status"] = item["texture_status"] = "failed"
        Rails.logger.warn("Furniture appearance item=#{item['item_id']} failed (#{error.class.name})")
      end
    end
    { scene: @scene, items: @items }
  end

  private

  def image_color?(item)
    item.dig("product_metadata", "color_source") == IMAGE_COLOR_SOURCE
  end

  def color_overrides(item, model)
    color = item["color"]
    return {} unless color.is_a?(String) && color.match?(/\A#[0-9a-f]{6}\z/i)

    material = SHAPE_MATERIALS[model.shape] || PRIMARY_MATERIALS.find { |name| model.materials.include?(name) }
    return {} unless material && model.materials.include?(material)

    overrides = { material => { "color" => color } }
    metadata = item.fetch("product_metadata", {})
    colors = InteriorLinks::ProductParser::COLORS.keys.count { |pattern| pattern.match?(metadata["color_name"].to_s) }
    # Upholstered templates may also represent a painted wooden frame. Recolor
    # that region only with published coating evidence and a single color name.
    material_description = metadata["material"].to_s
    if image_color?(item) && colors == 1 && model.materials.include?("wood") &&
       PAINTED_WOOD.match?(material_description) && !CLEAR_FINISH.match?(material_description)
      overrides["wood"] = { "color" => color }
    end
    overrides
  end
end
