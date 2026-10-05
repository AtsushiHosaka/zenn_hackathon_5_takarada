require "net/http"
require "googleauth"
require "timeout"

module InteriorLinks
  # Google Search grounding discovers URLs only. Generated numbers never enter product data.
  class SearchDiscovery
    DEFAULT_MODEL = "gemini-3.5-flash".freeze
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
      required = Array(categories).filter_map { |category| CATEGORY_NAMES[category.to_s] }.uniq
      query = <<~PROMPT
        日本で販売されている家具・インテリアの公式EC商品をGoogle検索で探してください。
        希望: #{prompt.to_s.first(2000)}
        テーマ: #{theme}、1商品の上限: #{max_price}円。
        #{required.any? ? "画面で指定された必須の対象用途: #{required.join('、')}。この用途の商品を優先して必ず検索してください。" : ""}
        希望文に明示された用途と店舗を優先してください。明示がある場合、無関係な家具や雑貨を検索しないでください。
        用途が明示されていない場合は、家具とインテリアから希望の雰囲気に合う商品を探してください。
        対象は www.ikea.com/jp/ja/p/、www.nitori-net.jp/ec/product/、www.low-ya.com/goods/、
        www.muji.com/jp/ja/store/cmdty/detail/ の日本の商品詳細のみです。
        検索クエリには必ず site:www.ikea.com/jp/ja/p/ または対象店舗の商品詳細パスを含むsite:指定を入れてください。
        検索で見つかった日本の商品詳細URLそのものだけを出してください。商品番号やURLを記憶から作らないでください。
        海外サイトのURLの国コードをjpへ置換したり、商品番号を日本用だと推測したりしないでください。
        対象を検索で確認できなければ件数を埋めず、その用途のURLは省いてください。
        希望に合う商品を最大8件、検索結果に基づく引用付きの短い自然文で紹介してください。
        各商品は公式の商品名と用途・色・形の短い説明、元の商品詳細URLを含めてください。
        URLだけのリストにはせず、検索した公式ページを根拠として説明と引用を付けてください。
        価格や寸法はこの回答から採用しないので出力不要です。カテゴリページや検索ページは含めないでください。
      PROMPT
      endpoint, headers = endpoint_and_headers
      body = { contents: [ { role: "user", parts: [ { text: query } ] } ], tools: [ { googleSearch: {} } ],
               generationConfig: { temperature: 1, maxOutputTokens: 4000 } }
      # Discovery needs a short answer, not prolonged reasoning/tool exploration.
      body[:generationConfig][:thinkingConfig] = { thinkingLevel: "LOW" } if search_model.start_with?("gemini-3")
      response = Timeout.timeout(60) do
        Net::HTTP.start(endpoint.host, endpoint.port, use_ssl: true, open_timeout: 5, read_timeout: 55, write_timeout: 10) do |http|
          http.post(endpoint.request_uri, body.to_json, headers)
        end
      end
      raise Error, "Google検索groundingが失敗しました (HTTP #{response.code})" unless response.is_a?(Net::HTTPSuccess)

      candidate = JSON.parse(response.body).fetch("candidates", []).first.to_h
      grounding = candidate["groundingMetadata"].to_h
      raise Error, "Google検索を実行した根拠が応答にありません" if Array(grounding["webSearchQueries"]).empty?

      text = Array(candidate.dig("content", "parts")).map { |part| part["text"].to_s }.join("\n")
      text_urls = text.scan(%r{https://[^\s<>"\[\]()]+}).map { |url| url.sub(/[.,、。]+\z/, "") }
      sources = Array(grounding["groundingChunks"]).filter_map { |chunk| chunk.dig("web", "uri") }
      resolved = GroundingSourceResolver.new.resolve(sources)
      fallback_urls = text_urls.select { |url| PageFetcher.store(url) }.uniq
      if resolved[:urls].empty? && fallback_urls.empty? && resolved[:diagnostics]["resolution_failed"].to_i.positive?
        raise Error.new("Google検索の出典を解決できませんでした", diagnostics: { "source_resolution" => resolved[:diagnostics] })
      end
      # Model URLs are only discovery hints; their values and existence are not
      # trusted. PageFetcher + ProductParser must verify the official page first.
      origins = fallback_urls.to_h { |url| [ url, "model_discovery_unverified" ] }
      resolved[:urls].each { |url| origins[url] = "google_grounding_source" }
      { urls: (resolved[:urls] + fallback_urls).uniq.first(12), origins:,
        source_resolution: resolved[:diagnostics].merge("model_discovery_url_count" => fallback_urls.length),
        queries: grounding["webSearchQueries"], search_model:,
        search_entry_point: grounding.dig("searchEntryPoint", "renderedContent") }
    rescue StandardError => e
      raise if e.is_a?(Error)

      raise Error.new("実商品検索に接続できませんでした: #{e.class.name}",
                      diagnostics: { "search_model" => search_model, "failure_class" => e.class.name })
    end

    private

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
