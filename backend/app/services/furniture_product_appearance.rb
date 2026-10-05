class FurnitureProductAppearance
  MAX_IMAGES = 3
  DEADLINE_SECONDS = 90

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
        object["texture_source"] = item["texture_source"] = "description"
        status = "disabled"
        if object["model_url"].present? && ENV["MODELS_BUCKET"].present? && GeminiImageClient.configured?(user_id: @user_id)
          @generator ||= FurnitureTextureGenerator.new
          generated = @generator.call(item: item, model: model, max_images: MAX_IMAGES - @generator.attempts, deadline: deadline)
          status = generated.overrides.present? ? "ready" : "skipped"
          object["material_overrides"] = generated.overrides if generated.overrides.present?
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
end
