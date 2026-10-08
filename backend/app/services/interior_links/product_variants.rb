require "nokogiri"

module InteriorLinks
  # Siblings come only from an explicit official color picker or ProductGroup.
  class ProductVariants
    MAX_VARIANTS = 24

    def self.call(document:, url:, store:, product:)
      new(document, url, store, product).call
    end

    def initialize(document, url, store, product)
      @document, @url, @store, @product = document, url, store, product
    end

    def call
      choices = @store[:provider] == "ikea" ? ikea_choices : []
      choices = structured_choices if choices.empty?
      choices.uniq { |choice| [ choice["url"], choice["variant_id"] ] }.first(MAX_VARIANTS)
    end

    private

    def ikea_choices
      @document.css('ul[aria-label="色を選択"]').flat_map do |picker|
        picker.css('a[aria-label][href], [aria-current="true"][aria-label]').filter_map do |node|
          name = node["aria-label"].to_s.strip
          target = verified_url(node["href"].presence || @url)
          next if name.blank? || !target

          { "color_name" => name.first(120), "url" => target,
            "variant_id" => URI(target).path[/-(\d{8})\/\z/, 1],
            "source" => "official_color_picker" }
        end
      end
    end

    def structured_choices
      nodes = @document.css('script[type="application/ld+json"]').flat_map do |script|
        walk(JSON.parse(script.text))
      rescue JSON::ParserError
        []
      end
      sku = @product["sku"].presence || @product["mpn"]
      group = nodes.find do |node|
        Array(node["@type"]).include?("ProductGroup") && variants(node).any? do |entry|
          entry.is_a?(Hash) && sku.present? && (entry["sku"] || entry["mpn"]).to_s == sku.to_s
        end
      end
      return [] unless group

      variants(group).filter_map do |entry|
        next unless entry.is_a?(Hash) && entry["color"].is_a?(String)

        offers = entry["offers"].is_a?(Array) ? entry["offers"] : [ entry["offers"] ]
        target = verified_url(entry["url"] || offers.find { |offer| offer.is_a?(Hash) && offer["url"].present? }&.fetch("url"))
        next unless target

        { "color_name" => entry["color"].first(120), "url" => target,
          "variant_id" => (entry["sku"] || entry["mpn"]).to_s.presence,
          "source" => "official_product_group" }
      end
    end

    def variants(group)
      value = group["hasVariant"]
      value.is_a?(Array) ? value : [ value ]
    end

    def walk(value)
      case value
      when Array then value.flat_map { |entry| walk(entry) }
      when Hash then [ value ] + value.values.filter_map { |entry| walk(entry) if entry.is_a?(Hash) || entry.is_a?(Array) }.flatten
      else []
      end
    end

    def verified_url(value)
      return if value.blank?

      uri = URI.join(@url, value.to_s)
      uri.fragment = nil
      target_store = PageFetcher.store(uri.to_s)
      return unless target_store && target_store[:provider] == @store[:provider]

      uri.to_s
    rescue URI::InvalidURIError
      nil
    end
  end
end
