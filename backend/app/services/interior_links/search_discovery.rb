require "net/http"
require "googleauth"
require "timeout"

module InteriorLinks
  # Google Search grounding discovers URLs only. Generated numbers never enter product data.
  class SearchDiscovery
    DEFAULT_MODEL = "gemini-3.5-flash".freeze
    MAX_BATCHES = 3
    MAX_URLS = 36
    REQUEST_SECONDS = 50
    SLOT_NAMES = { "bed_cover" => "寝具・ベッドカバー", "curtain" => "カーテン", "rug" => "ラグ",
                   "wall_decor" => "壁飾り・アート・タペストリー・ウォールシェルフ", "light" => "照明",
                   "display" => "コレクションケース・飾り物・花瓶", "cushion" => "クッション",
                   "desk_top" => "アクスタケース・うちわスタンド・デスク上の小物" }.freeze
    # Nitori is searched through its Yahoo! store: the official site often times out.
    STORE_PATHS = %w[www.ikea.com/jp/ja/p/ store.shopping.yahoo.co.jp/nitori-net/ francfranc.com/products/
                     www.low-ya.com/goods/ www.muji.com/jp/ja/store/cmdty/detail/ store.shopping.yahoo.co.jp/].freeze
    # nitori-net.jp answers in ~10s, beyond PageFetcher's read timeout; its Yahoo! store
    # carries the same products. Previously saved official URLs are still fetchable.
    SKIPPED_DISCOVERY_HOSTS = %w[www.nitori-net.jp].freeze
    BATCH_PRIORITY_PATHS = [ STORE_PATHS.values_at(0, 1), STORE_PATHS.values_at(2, 3, 4), STORE_PATHS ].freeze
    CATEGORY_NAMES = { "sofa" => "ソファ", "bed" => "ベッド", "desk" => "デスク", "chair" => "椅子",
                       "shelf" => "本棚・収納棚", "table" => "テーブル" }.freeze
    class Error < StandardError
      attr_reader :diagnostics

      def initialize(message, diagnostics: {})
        @diagnostics = diagnostics
        super(message)
      end
    end

    def initialize(user_id: nil)
      raise Error, "実商品検索のGemini認証が設定されていません" unless GeminiClient.configured?(user_id:)
    end

    def search(prompt:, theme:, slots:, categories:, max_price:)
      endpoint, headers = endpoint_and_headers
      batches = search_batches(slots, categories)
      # Each batch has a different purpose/store emphasis; bounded parallel calls
      # leave the shared catalog deadline available for official-page extraction.
      workers = []
      batches.each_with_index do |targets, index|
        workers << Thread.new do
          perform_search(endpoint, headers, query(prompt:, theme:, targets:, max_price:, index:))
        rescue Error => e
          { error: e }
        end
      end
      results = workers.map(&:value)
      successful = results.reject { |result| result[:error] }
      if successful.empty?
        raise Error.new("Google検索で商品候補を取得できませんでした",
                        diagnostics: { "search_model" => search_model, "batch_count" => batches.length,
                                       "batch_failures" => results.map { |result| result[:error].message } })
      end

      sources = interleave(successful.map { |result| result[:sources] })
      resolved = GroundingSourceResolver.new.resolve(sources)
      skipped = resolved[:urls].count { |url| skipped_host?(url) }
      resolved[:urls] = resolved[:urls].reject { |url| skipped_host?(url) }
      resolved[:diagnostics] = resolved[:diagnostics].merge("skipped_slow_store" => skipped)
      fallback_urls = interleave(successful.map { |result| result[:text_urls] }).select { |url| PageFetcher.store(url) && !skipped_host?(url) }.uniq
      if resolved[:urls].empty? && fallback_urls.empty? && resolved[:diagnostics]["resolution_failed"].to_i.positive?
        raise Error.new("Google検索の出典を解決できませんでした", diagnostics: { "source_resolution" => resolved[:diagnostics] })
      end
      # Model URLs remain unverified discovery hints. Official-page extraction
      # must establish the product identity and evidence before they are used.
      origins = fallback_urls.to_h { |url| [ url, "model_discovery_unverified" ] }
      resolved[:urls].each { |url| origins[url] = "google_grounding_source" }
      entries = successful.filter_map { |result| result[:search_entry_point].presence }.uniq
      { urls: (resolved[:urls] + fallback_urls).uniq.first(MAX_URLS), origins:,
        source_resolution: resolved[:diagnostics].merge("model_discovery_url_count" => fallback_urls.length,
                                                      "batch_count" => batches.length, "successful_batch_count" => successful.length,
                                                      "batch_failures" => results.filter_map { |result| result[:error]&.message }),
        queries: successful.flat_map { |result| result[:queries] }.uniq, search_model:,
        search_entry_point: entries.first, search_entry_points: entries }
    rescue StandardError => e
      raise if e.is_a?(Error)

      raise Error.new("実商品検索に接続できませんでした: #{e.class.name}",
                      diagnostics: { "search_model" => search_model, "failure_class" => e.class.name })
    ensure
      workers&.each { |worker| worker.kill if worker.alive? }
      workers&.each(&:join)
    end

    private

    def skipped_host?(url)
      SKIPPED_DISCOVERY_HOSTS.include?(URI.parse(url).host)
    rescue URI::InvalidURIError
      true
    end

    def interleave(groups)
      queues = groups.map(&:dup)
      result = []
      while queues.any?(&:any?)
        queues.each { |queue| result << queue.shift if queue.any? }
      end
      result
    end

    def search_batches(slots, categories)
      requested_slots = Array(slots).map(&:to_s)
      targets = Array(categories).filter_map { |category| CATEGORY_NAMES[category.to_s] }.uniq if requested_slots.include?("floor")
      targets = Array(targets) + requested_slots.filter_map { |slot| SLOT_NAMES[slot] }.uniq
      targets << "家具・インテリア" if targets.empty?
      # A single category still needs several stores and price bands, rather than
      # the same small shortlist returned by one broad Google query.
      return Array.new(MAX_BATCHES) { targets } if targets.length < MAX_BATCHES

      targets.each_with_index.each_with_object(Array.new(MAX_BATCHES) { [] }) do |(target, index), groups|
        groups[index % MAX_BATCHES] << target
      end
    end

    def query(prompt:, theme:, targets:, max_price:, index:)
      priority_paths = BATCH_PRIORITY_PATHS.fetch(index, STORE_PATHS)
      <<~PROMPT
        日本の家具・インテリア雑貨ECの商品をGoogle検索で探してください。
        希望・テンプレート: #{prompt.to_s.first(4000)}
        テーマ: #{theme}。1商品の上限: #{max_price}円。安価な候補も含めてください。
        検索する用途候補: #{targets.join('、')}。希望に用途指定があればそれを優先し、無関係な用途は検索しないでください。
        優先サイト: #{priority_paths.join('、')}。希望の店舗指定を優先してください。
        許可した商品詳細のパス: #{STORE_PATHS.join('、')}（Yahoo!ショッピングは store.shopping.yahoo.co.jp/<ストア>/<商品コード>.html）。
        site:指定を含む検索クエリを最大3個にまとめ、各検索結果から複数商品を拾ってください。
        #{index == 2 ? 'この回は低価格帯の候補を優先してください。' : ''}
        最大12件、商品ごとに「公式商品名・詳細URL・出典引用」を1行で出してください。価格・寸法や説明文は不要です。
        ニトリはYahoo!ショッピングのnitori-netストアの商品詳細URLを返し、公式サイトの商品番号をYahoo!のURLに流用しないでください。
        URLを記憶から作ったり国コードを置換したりせず、検索で見つかった日本の商品詳細URLだけを返してください。
        確認できなければ件数を埋めず省いてください。カテゴリページや検索ページは含めないでください。
      PROMPT
    end

    def perform_search(endpoint, headers, query)
      body = { contents: [ { role: "user", parts: [ { text: query } ] } ], tools: [ { googleSearch: {} } ],
               generationConfig: { temperature: 1, maxOutputTokens: 3500 } }
      if search_model.start_with?("gemini-3")
        effort = search_model.start_with?("gemini-3.5") ? "MINIMAL" : "LOW"
        body[:generationConfig][:thinkingConfig] = { thinkingLevel: effort }
      end
      response = Timeout.timeout(REQUEST_SECONDS) do
        Net::HTTP.start(endpoint.host, endpoint.port, use_ssl: true, open_timeout: 5, read_timeout: 45, write_timeout: 10) do |http|
          http.post(endpoint.request_uri, body.to_json, headers)
        end
      end
      raise Error, "Google検索groundingが失敗しました (HTTP #{response.code})" unless response.is_a?(Net::HTTPSuccess)

      candidate = JSON.parse(response.body).fetch("candidates", []).first.to_h
      grounding = candidate["groundingMetadata"].to_h
      raise Error, "Google検索を実行した根拠が応答にありません" if Array(grounding["webSearchQueries"]).empty?

      text = Array(candidate.dig("content", "parts")).map { |part| part["text"].to_s }.join("\n")
      { text_urls: text.scan(%r{https://[^\s<>"\[\]()]+}).map { |url| url.sub(/[.,、。]+\z/, "") },
        sources: Array(grounding["groundingChunks"]).filter_map { |chunk| chunk.dig("web", "uri") },
        queries: grounding["webSearchQueries"], search_entry_point: grounding.dig("searchEntryPoint", "renderedContent") }
    rescue StandardError => e
      raise if e.is_a?(Error)

      raise Error, "Google検索の取得に失敗しました: #{e.class.name}"
    end

    def endpoint_and_headers
      model = search_model
      raise Error, "検索モデル名が不正です" unless model.match?(/\A[a-zA-Z0-9._-]+\z/)

      headers = { "Content-Type" => "application/json" }
      if GeminiClient.provider == "vertex"
        project = ENV["GOOGLE_CLOUD_PROJECT"].to_s
        raise Error, "GCPプロジェクトIDが不正です" unless project.match?(/\A[a-z][a-z0-9-]{4,28}[a-z0-9]\z|\A[0-9]+\z/)

        endpoint = URI("https://aiplatform.googleapis.com/v1/projects/#{project}/locations/global/publishers/google/models/#{model}:generateContent")
        Google::Auth.get_application_default([ GeminiClient::SCOPE ]).apply!(headers)
      else
        endpoint = URI("https://generativelanguage.googleapis.com/v1beta/models/#{model}:generateContent")
        headers["x-goog-api-key"] = ENV.fetch("GEMINI_API_KEY")
      end
      [ endpoint, headers ]
    end

    def search_model
      ENV["EC_SEARCH_MODEL"].presence || DEFAULT_MODEL
    end
  end
end
