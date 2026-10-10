class FurnitureProductAppearance
  MAX_IMAGES = 3
  DEADLINE_SECONDS = 90
  IMAGE_COLOR_SOURCE = "product_image_dominant_color_v1".freeze

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
        model = Furniture.available.find_by(id: item.dig("product_metadata", "furniture_id"))
        unless model
          object["model_url"] = nil
          object["texture_status"] = item["texture_status"] = "unmatched"
          next
        end
        model_match = { "model_id" => model.id, "reason" => "furniture_detail", "approximate" => true }
        object["model_match"] = item["model_match"] = model_match
        object["model_url"] = FurnitureModelCatalog.model_url(model)
        object["model_size"] = { "w" => model.width.to_f, "h" => model.height.to_f, "d" => model.depth.to_f }
        object["model_fit"] = "contain"
        object["color"] ||= item["color"]
        edited_color = object["color"] != item["color"]
        overrides = color_overrides(item, model, edited_color: edited_color ? object["color"] : nil)
        # Apply the product color even without image generation or its dependencies.
        object["material_overrides"] = overrides if overrides.present?
        status = overrides.present? ? "ready" : "disabled"
        # 商品ページの説明は 1 色分なので、色が 1 部位だけの商品にだけテクスチャを作る
        if !edited_color && !image_color?(item) && overrides.one? && item.dig("product_metadata", "provider").present? && object["model_url"].present? && ENV["MODELS_BUCKET"].present? && GeminiImageClient.configured?(user_id: @user_id)
          object["texture_source"] = item["texture_source"] = "description"
          @generator ||= FurnitureTextureGenerator.new
          generated = @generator.call(item: item, model: model, materials: overrides.keys, max_images: MAX_IMAGES - @generator.attempts, deadline: deadline)
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

  # detail の部位ごとの色で塗る。画面で色を変えた家具は主な部位をその色にする
  def color_overrides(item, model, edited_color:)
    colors = item.dig("product_metadata", "color_materials").to_h.slice(*model.color_material_keys)
    colors = colors.merge(model.primary_color_key => edited_color) if edited_color&.match?(/\A#[0-9a-f]{6}\z/i) && model.primary_color_key
    colors.transform_values { |color| { "color" => color } }
  end
end
