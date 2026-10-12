require "json"
require "nokogiri"
require "net/http"
require "ipaddr"
require "resolv"
require "timeout"
require "digest"
require "time"
require "uri"

# Offline catalogue enrichment. Official colour selectors establish families;
# sharing a 3D model, a name or a search result never establishes a variant.
# This service neither searches external shops nor writes database records.
class ShopColorVariants
  MAX_VARIANTS = 24
  COLORS = {
    /シアン|ターコイズ|ティール|cyan|turquoise|teal/i => "#39b9c2",
    /ブルー|青|水色|blue/i => "#71bddc",
    /グリーン|緑|ミント|green|mint/i => "#86bfa4",
    /ホワイト|白|white/i => "#f3f4f0", /アイボリー|ivory/i => "#eee9da",
    /ブラック|黒|black/i => "#303030", /グレー|灰|grey|gray/i => "#a6a8a8",
    /ブラウン|茶|brown/i => "#987b61", /ベージュ|beige/i => "#c4ae8c",
    /パープル|紫|ラベンダー|purple|lavender/i => "#ad96bb", /ピンク|pink/i => "#d6a5b3",
    /レッド|赤|red/i => "#b66a60", /オレンジ|orange/i => "#e1a66b", /イエロー|黄|yellow/i => "#e2cf75"
  }.freeze
  class Error < StandardError; end

  class Fetcher
    MAX_BYTES = 4 * 1024 * 1024
    HOSTS = { "www.ikea.com" => %r{\A/jp/ja/p/[^/]+/\z}, "francfranc.com" => %r{\A/products/[A-Za-z0-9_-]+/?\z} }.freeze
    NONPUBLIC_V4 = %w[0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 192.88.99.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 224.0.0.0/3].map { |value| IPAddr.new(value) }.freeze
    PUBLIC_V6 = IPAddr.new("2000::/3")
    NONPUBLIC_V6 = %w[2001::/23 2001:db8::/32 2002::/16 3fff::/20].map { |value| IPAddr.new(value) }.freeze
    USER_AGENT = "RoomCoordinationCatalogVerifier/1.0".freeze

    def self.url(value, base = nil)
      uri = base ? URI.join(base, value.to_s) : URI.parse(value.to_s)
      uri.fragment = nil
      pattern = HOSTS[uri.host]
      return unless uri.scheme == "https" && uri.port == 443 && !uri.userinfo && pattern && pattern.match?(uri.path)

      uri.to_s
    rescue URI::InvalidURIError
      nil
    end

    def initialize
      @pages = {}
      @robots = {}
    end

    def fetch(value)
      target = self.class.url(value)
      raise Error, "unsupported_product_url" unless target

      @pages[target] ||= begin
        uri = URI(target)
        raise Error, "robots_disallowed" unless robots_allowed?(uri)

        request(uri)
      end
    end

    private

    def request(uri, redirects = 0, robots = false)
      raise Error, "redirect_limit" if redirects > 3
      raise Error, "unsupported_redirect" unless uri.scheme == "https" && uri.port == 443 && !uri.userinfo && HOSTS.key?(uri.host)

      addresses = Timeout.timeout(5) { Resolv.getaddresses(uri.host) }
      raise Error, "nonpublic_address" if addresses.empty? || addresses.any? { |address| nonpublic?(address) }

      response = Timeout.timeout(15) do
        connection = Net::HTTP.new(uri.host, uri.port, nil)
        connection.use_ssl = true
        connection.open_timeout = 5
        connection.read_timeout = 10
        raise Error, "ruby_runtime_missing_dns_pinning" unless connection.respond_to?(:ipaddr=)

        connection.ipaddr = addresses.first
        connection.start do |http|
          http.request(Net::HTTP::Get.new(uri.request_uri, "User-Agent" => USER_AGENT, "Accept" => "text/html")) do |result|
            body = +""
            result.read_body do |chunk|
              body << chunk
              raise Error, "response_too_large" if body.bytesize > MAX_BYTES
            end
            result.body = body
          end
        end
      end
      if response.is_a?(Net::HTTPRedirection)
        target = URI.join(uri.to_s, response["location"].to_s)
        raise Error, "unsupported_redirect" unless robots || self.class.url(target.to_s)
        raise Error, "robots_disallowed" unless robots || robots_allowed?(target)

        return request(target, redirects + 1, robots)
      end
      return { "html" => "", "url" => uri.to_s } if robots && response.code.to_i == 404
      raise Error, "http_#{response.code}" unless response.is_a?(Net::HTTPSuccess)
      if robots
        raise Error, "invalid_robots" if response["content-type"].to_s.include?("text/html")
      else
        raise Error, "not_html" unless response["content-type"].to_s.include?("text/html")
      end
      { "html" => response.body, "url" => uri.to_s }
    rescue SocketError, Resolv::ResolvError, Timeout::Error, IOError, SystemCallError, OpenSSL::SSL::SSLError => error
      raise Error, "fetch_failed:#{error.class}"
    end

    def nonpublic?(address)
      ip = IPAddr.new(address)
      ip.ipv4? ? NONPUBLIC_V4.any? { |range| range.include?(ip) } : !PUBLIC_V6.include?(ip) || NONPUBLIC_V6.any? { |range| range.include?(ip) }
    end

    def robots_allowed?(uri)
      rules = @robots[uri.host] ||= robot_rules(request(URI("https://#{uri.host}/robots.txt"), 0, true).fetch("html"))
      matching = rules.select { |rule| Regexp.new("\\A" + Regexp.escape(rule[1]).gsub('\\*', ".*").sub(/\\\$\z/, "$")).match?(uri.request_uri) }
      winner = matching.max_by { |rule| [ rule[1].delete("*$").length, rule[0] == "allow" ? 1 : 0 ] }
      !winner || winner[0] == "allow"
    end

    def robot_rules(body)
      groups = []
      group = { agents: [], rules: [] }
      body.each_line do |line|
        key, value = line.split("#", 2).first.to_s.strip.split(":", 2).map { |part| part.strip }
        next unless value

        if key.downcase == "user-agent"
          if group[:rules].any?
            groups << group
            group = { agents: [], rules: [] }
          end
          group[:agents] << value.downcase
        elsif %w[allow disallow].include?(key.downcase) && !value.empty?
          group[:rules] << [ key.downcase, value ]
        end
      end
      groups << group
      specific = groups.select { |entry| entry[:agents].any? { |agent| agent != "*" && USER_AGENT.downcase.start_with?(agent) } }
      (specific.empty? ? groups.select { |entry| entry[:agents].include?("*") } : specific).flat_map { |entry| entry[:rules] }
    end
  end

  class Parser
    attr_reader :product, :document, :url

    def initialize(page)
      @url = page.fetch("url")
      @document = Nokogiri::HTML(page.fetch("html"))
      @nodes = document.css('script[type="application/ld+json"]').flat_map do |script|
        walk(JSON.parse(script.text))
      rescue JSON::ParserError
        []
      end
      @product = @nodes.find { |node| Array(node["@type"]).include?("Product") && identity_matches?(node) }
      raise Error, "selected_product_unverified" unless product
    end

    def choices
      picker = document.css('ul[aria-label="色を選択"]')
      choices = picker.flat_map do |list|
        list.css('a[aria-label][href], [aria-current="true"][aria-label]').map do |node|
          choice(node["aria-label"], node["href"] || url)
        end.compact
      end
      if choices.empty?
        group = @nodes.find do |node|
          Array(node["@type"]).include?("ProductGroup") && Array(node["hasVariant"]).any? { |entry| entry.is_a?(Hash) && sku(entry) == sku(product) }
        end
        choices = Array(group && group["hasVariant"]).map do |entry|
          choice(entry["color"], entry["url"]) if entry.is_a?(Hash)
        end.compact
      end
      choices.uniq { |entry| entry["url"] }.first(MAX_VARIANTS)
    end

    def attributes(expected_color = nil)
      name = product["name"].to_s.strip
      color = product["color"].to_s.strip
      color = expected_color.to_s.strip if color.empty?
      raise Error, "missing_name_or_color" if name.empty? || color.empty? || sku(product).empty?
      if expected_color && normalize(color) != normalize(expected_color)
        # Retail JSON-LD may use a broad colour ("blue") while the explicit
        # picker and this exact SKU's own title publish "light blue". Both
        # pages must corroborate the precise picker label before using it.
        raise Error, "color_mismatch" unless normalize(name).include?(normalize(expected_color))

        color = expected_color
      end

      offers = product["offers"].is_a?(Array) ? product["offers"] : [ product["offers"] ]
      offer = offers.find { |entry| entry.is_a?(Hash) && entry["priceCurrency"] == "JPY" && (!entry["url"] || Fetcher.url(entry["url"], url) == url) }
      raise Error, "missing_variant_jpy_price" unless offer && offer["price"].to_s.match?(/\A\d+(?:\.0+)?\z/)

      price = offer["price"].to_f.to_i
      raise Error, "invalid_price" unless price.positive?

      status = case offer["availability"].to_s
      when /OutOfStock|Discontinued|SoldOut/ then "out_of_stock"
      when /InStock|LimitedAvailability/ then "in_stock"
      when /PreOrder|BackOrder/ then "back_order"
      when "" then "listed"
      else "unknown"
      end
      image = Array(product["image"]).first
      image = image["contentUrl"] || image["url"] if image.is_a?(Hash)
      { "name" => name, "color_name" => color, "price" => price, "image_url" => image,
        "retail_variant_key" => "#{provider}:#{sku(product)}", "retail_availability" => status,
        "retail_source_url" => url, "url" => url }
    end

    # Only actual product measurements participate; package measurements do not.
    def dimensions
      document.css('[class*="measurements-tab__measurement-row"]').map do |row|
        label = row.at_css('[class*="measurement-name"]')&.text.to_s.strip
        value = row.at_css('[class*="measurement-value"]')&.text.to_s.strip
        next unless value.match?(/\A[\d.]+\s*(?:mm|cm|m)\z/) && !label.match?(/荷重|重さ/)

        [ normalize(label), normalize(value) ]
      end.compact.sort
    end

    def provider
      URI(url).host == "www.ikea.com" ? "ikea" : "francfranc"
    end

    private

    def choice(color, value)
      target = Fetcher.url(value, url)
      return unless target && URI(target).host == URI(url).host && color.is_a?(String) && !color.strip.empty?

      { "color_name" => color.strip, "url" => target }
    end

    def identity_matches?(node)
      if URI(url).host == "www.ikea.com"
        sku(node) == URI(url).path[/-(\d{8})\/\z/, 1]
      else
        offers = node["offers"].is_a?(Array) ? node["offers"] : [ node["offers"] ]
        targets = [ node["url"] ] + offers.map { |offer| offer["url"] if offer.is_a?(Hash) }
        targets.compact.any? { |target| Fetcher.url(target, url) == url }
      end
    end

    def sku(node)
      value = (node["sku"] || node["mpn"]).to_s
      URI(url).host == "www.ikea.com" ? value.delete(".") : value
    end

    def normalize(value)
      value.to_s.gsub(/[\s\u00a0]+/, "").downcase
    end

    def walk(value)
      case value
      when Array then value.flat_map { |entry| walk(entry) }
      when Hash then [ value ] + value.values.flat_map { |entry| entry.is_a?(Hash) || entry.is_a?(Array) ? walk(entry) : [] }
      else []
      end
    end
  end

  def self.call(source, fetcher: Fetcher.new, limit: nil)
    new(source, fetcher: fetcher, limit: limit).call
  end

  def initialize(source, fetcher:, limit:)
    @source = source
    @fetcher = fetcher
    @limit = limit
    @audit = []
  end

  def call
    rows = @source.fetch("details")
    raise Error, "details_must_be_array" unless rows.is_a?(Array)

    enriched = Marshal.load(Marshal.dump(rows))
    eligible = rows.select { |row| Fetcher.url(row["url"]) }
    unsupported = rows.reject { |row| Fetcher.url(row["url"]) }
    eligible = eligible.first(@limit) if @limit
    refreshed_keys = (eligible + unsupported).map { |row| row["key"] }
    refreshed_families = eligible.map { |row| row["retail_family_key"] }.compact
    # An unsuccessful refresh must not leave a previous stock claim eligible.
    enriched.each do |row|
      next unless refreshed_keys.include?(row["key"]) || refreshed_families.include?(row["retail_family_key"])

      %w[retail_family_key retail_variant_key retail_source_url retail_checked_at retail_availability].each { |field| row.delete(field) }
    end
    unsupported.each { |row| report(row, "unsupported") }
    eligible.each do |row|
      enrich(row, enriched)
    rescue Error => error
      report(row, "failed", "reason" => error.message)
    end
    { "catalogue" => @source.merge("details" => enriched, "checked_at" => Time.now.utc.iso8601), "audit" => @audit }
  end

  private

  def enrich(row, enriched)
    parser = Parser.new(@fetcher.fetch(row.fetch("url")))
    choices = parser.choices
    if choices.empty?
      choices = [ { "url" => parser.url, "color_name" => parser.attributes.fetch("color_name") } ]
    elsif choices.none? { |choice| choice["url"] == parser.url }
      return report(row, "unverified_family_membership")
    end

    baseline = parser.dimensions
    return report(row, "unverified_dimensions") if baseline.empty?

    family = "#{parser.provider}:#{Digest::SHA256.hexdigest(choices.map { |entry| entry['url'] }.sort.join('\n'))[0, 24]}"
    choices.each do |choice|
      candidate = Parser.new(@fetcher.fetch(choice.fetch("url")))
      unless candidate.dimensions == baseline
        report(row, "skipped_size_change", "variant_url" => choice["url"])
        next
      end
      attrs = candidate.attributes(choice.fetch("color_name"))
      if %w[out_of_stock back_order unknown].include?(attrs["retail_availability"])
        if attrs["retail_availability"] == "out_of_stock" && (old = enriched.find { |detail| Fetcher.url(detail["url"]) == attrs["url"] })
          old.merge!(attrs, "retail_family_key" => family, "retail_checked_at" => Time.now.utc.iso8601)
        end
        report(row, "skipped_unavailable", "variant_url" => choice["url"], "availability" => attrs["retail_availability"])
        next
      end
      color = COLORS.find { |pattern, _| pattern.match?(attrs.fetch("color_name")) }&.last
      unless color
        report(row, "unsupported_color", "variant_url" => choice["url"], "color_name" => attrs["color_name"])
        next
      end
      old = enriched.find { |detail| Fetcher.url(detail["url"]) == attrs["url"] }
      detail = Marshal.load(Marshal.dump(old || row))
      detail.merge!(attrs, "retail_family_key" => family, "retail_checked_at" => Time.now.utc.iso8601)
      detail["key"] = "retail:#{attrs.fetch('retail_variant_key')}" unless old
      detail["symbolic_color"] = color
      primary = %w[tint fabric wood metal].find { |key| detail.fetch("color_materials").key?(key) } || detail.fetch("color_materials").keys.first
      detail["color_materials"][primary] = color if primary
      old ? enriched[enriched.index(old)] = detail : enriched << detail
      report(row, old ? "verified_existing" : "added", "variant_key" => attrs["retail_variant_key"], "variant_url" => attrs["url"], "color_name" => attrs["color_name"], "family_key" => family)
    rescue Error => error
      report(row, "variant_failed", "variant_url" => choice["url"], "reason" => error.message)
    end
  end

  def report(row, status, extra = {})
    @audit << { "key" => row["key"], "url" => row["url"], "status" => status }.merge(extra)
  end
end
