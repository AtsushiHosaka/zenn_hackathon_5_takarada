require "timeout"

module InteriorLinks
  class RealClient
    DEADLINE_SECONDS = 90
    PAGE_WORKERS = 6
    class Error < StandardError
      attr_reader :diagnostics

      def initialize(message, diagnostics: {})
        @diagnostics = diagnostics
        super(message)
      end
    end

    attr_reader :diagnostics, :search_entry_points

    def initialize(user_id: nil, preferred_categories: nil)
      @user_id = user_id
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
      @search_entry_points = (@search_entry_points + Array(result[:search_entry_points])).uniq
      candidates = []
      results = fetch_products(ordered_urls(result[:urls]), started)
      fetched_count = results.count { |entry| entry[:fetched] }
      results.each do |entry|
        url = entry[:url]
        if entry[:failure]
          @diagnostics["failures"] << { "url" => url, "reason" => entry[:failure] }
        elsif entry[:excluded]
          @diagnostics["excluded"] << { "url" => url, "reason" => entry[:excluded] }
        else
          attributes = entry.fetch(:attributes)
          origin = result[:origins].to_h[url] || "official_url_fixture"
          @diagnostics["verified_official_page_count"] += 1
          @diagnostics["verified_discovery_sources"][origin] = @diagnostics["verified_discovery_sources"].fetch(origin, 0) + 1
          attributes[:metadata]["discovery_source"] = origin
          attributes[:metadata]["source_verification"] = "verified_official_page"
          if attributes[:price] > max_price
            @diagnostics["excluded"] << { "url" => url, "reason" => "over_budget" }
            next
          end

          candidates << persist(attributes)
        end
      end
      candidates = candidates.uniq(&:id)
      @diagnostics["discovered_url_count"] = result[:urls].size
      @diagnostics["fetched_page_count"] = fetched_count
      @diagnostics["candidate_count"] = candidates.size
      @diagnostics["estimated_dimension_count"] = candidates.count { |item| item.metadata["estimated_axes"].present? }
      @diagnostics["extraction_methods"] = candidates.group_by { |item| item.metadata["extraction_method"] || "structured_html" }.transform_values(&:size)
      if result[:urls].any? && fetched_count.zero?
        raise Error.new("公式ECの商品ページを取得できませんでした。条件を変えて再度お試しください", diagnostics: @diagnostics)
      end

      candidates
    end

    # Network and extraction run concurrently; all database writes stay on the
    # caller's connection. Slow retailers do not hold up every other candidate.
    def fetch_products(urls, started)
      queue = Queue.new
      urls.each_with_index { |url, index| queue << [ index, url ] }
      results = Array.new(urls.size)
      parser_class = ProductParser
      workers = Array.new([ PAGE_WORKERS, urls.size ].min) do
        Thread.new do
          Rails.application.executor.wrap do
            loop do
              index, url = queue.pop(true)
              results[index] = fetch_product(url, started, parser_class)
            rescue ThreadError
              break
            end
          end
        end
      end
      ActiveSupport::Dependencies.interlock.permit_concurrent_loads { workers.each(&:value) }
      results
    ensure
      Array(workers).each { |worker| worker.kill if worker.alive? }
      Array(workers).each(&:join)
    end

    def fetch_product(url, started, parser_class)
      fetched = false
      remaining = DEADLINE_SECONDS - (Process.clock_gettime(Process::CLOCK_MONOTONIC) - started)
      return { url:, failure: "search_deadline", fetched: } if remaining < 1

      attributes = Timeout.timeout(remaining) do
        page = @fetcher.fetch(url)
        fetched = true
        parser_class.new(user_id: @user_id).parse(**page)
      end
      { url:, fetched:, attributes: }
    rescue PageFetcher::Error, Timeout::Error => e
      { url:, fetched:, failure: e.is_a?(Timeout::Error) ? "search_deadline" : e.message }
    rescue ProductParser::Unverified => e
      { url:, fetched:, excluded: e.message }
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
