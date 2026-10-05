require "timeout"

module InteriorLinks
  class RealClient
    DEADLINE_SECONDS = 90
    class Error < StandardError
      attr_reader :diagnostics

      def initialize(message, diagnostics: {})
        @diagnostics = diagnostics
        super(message)
      end
    end

    attr_reader :diagnostics, :search_entry_points

    def initialize(user_id: nil, preferred_categories: nil)
      @discovery = SearchDiscovery.new(user_id:)
      @preferred_categories = Array(preferred_categories).map(&:to_s).uniq & FLOOR_CATEGORIES
      @fetcher = PageFetcher.new
      @diagnostics = {}
      @catalog_cache = {}
      @search_entry_points = []
    rescue SearchDiscovery::Error => e
      raise Error.new(e.message, diagnostics: e.diagnostics)
    end

    def search(prompt: "", theme: nil, slots:, max_price:, categories: nil, **)
      slots = Array(slots).map(&:to_s) & SLOTS
      categories = Array(categories).map(&:to_s)
      key = [ prompt, theme, max_price ]
      candidates = @catalog_cache[key] ||= fetch_catalog(prompt:, theme:, max_price:)
      candidates.select do |item|
        slots.include?(item.slot) && (item.slot != "floor" || categories.empty? || categories.include?(item.category))
      end.group_by(&:slot)
    rescue SearchDiscovery::Error => e
      raise Error.new(e.message, diagnostics: e.diagnostics)
    end

    private

    def fetch_catalog(prompt:, theme:, max_price:)
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      # A job may request several floor operation groups; discover and fetch once.
      result = @discovery.search(prompt:, theme:, slots: SLOTS, categories: @preferred_categories, max_price:)
      if result[:search_entry_point].present?
        @search_entry_points = (@search_entry_points + [ result[:search_entry_point] ]).uniq
      end
      @diagnostics = { "provider" => "live", "search_model" => result[:search_model], "queries" => result[:queries], "failures" => [], "excluded" => [],
                       "source_resolution" => result[:source_resolution],
                       "verified_official_page_count" => 0, "verified_discovery_sources" => {},
                       "search_entry_point" => result[:search_entry_point] }
      candidates = []
      fetched_count = 0
      ordered_urls(result[:urls]).each do |url|
        remaining = DEADLINE_SECONDS - (Process.clock_gettime(Process::CLOCK_MONOTONIC) - started)
        if remaining < 1
          @diagnostics["failures"] << { "url" => url, "reason" => "search_deadline" }
          break
        end
        begin
          page = Timeout.timeout(remaining) { @fetcher.fetch(url) }
          fetched_count += 1
          attributes = ProductParser.new.parse(**page)
          origin = result[:origins].to_h[url] || "official_url_fixture"
          @diagnostics["verified_official_page_count"] += 1
          @diagnostics["verified_discovery_sources"][origin] = @diagnostics["verified_discovery_sources"].fetch(origin, 0) + 1
          attributes[:metadata]["discovery_source"] = origin
          attributes[:metadata]["source_verification"] = "verified_official_page"
          next unless attributes[:price] <= max_price

          candidates << persist(attributes)
        rescue PageFetcher::Error, Timeout::Error => e
          @diagnostics["failures"] << { "url" => url, "reason" => e.message }
        rescue ProductParser::Unverified => e
          @diagnostics["excluded"] << { "url" => url, "reason" => e.message }
        end
      end
      if result[:urls].any? && fetched_count.zero?
        raise Error.new("公式ECの商品ページを取得できませんでした。条件を変えて再度お試しください", diagnostics: @diagnostics)
      end

      candidates.uniq(&:id)
    end

    def persist(attributes)
      metadata = attributes[:metadata]
      identity = metadata.slice("provider", "provider_product_id", "variant_id")
      record = EcProduct.create_or_find_by!(identity) do |product|
        product.source_url = attributes[:url]
        product.data = attributes.stringify_keys
        product.fetched_at = Time.iso8601(metadata["fetched_at"])
      end
      record.update!(source_url: attributes[:url], data: attributes.stringify_keys, fetched_at: Time.iso8601(metadata["fetched_at"]))
      Item.build(id: record.product_id, **attributes)
    end

    def ordered_urls(urls)
      queues = urls.group_by { |url| PageFetcher.store(url)&.fetch(:provider) }.values
      # Give each provider an attempt before a slow retailer consumes the deadline.
      result = []
      while queues.any?(&:any?)
        queues.each { |queue| result << queue.shift if queue.any? }
      end
      result
    end
  end
end
