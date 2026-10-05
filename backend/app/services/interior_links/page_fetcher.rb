require "net/http"
require "ipaddr"
require "resolv"
require "timeout"

module InteriorLinks
  # Only public Japanese product pages are fetched; redirects are checked again.
  class PageFetcher
    MAX_BYTES = 4 * 1024 * 1024
    USER_AGENT = "RoomCoordinationProductVerifier/1.0".freeze
    STORES = {
      "www.ikea.com" => { provider: "ikea", shop: "IKEA", path: %r{\A/jp/ja/p/[^/]+/\z} },
      "www.nitori-net.jp" => { provider: "nitori", shop: "ニトリネット", path: %r{\A/ec/product/[A-Za-z0-9_-]+/\z} },
      "www.low-ya.com" => { provider: "lowya", shop: "LOWYA", path: %r{\A/goods/[A-Za-z0-9_-]+/?\z} },
      "www.muji.com" => { provider: "muji", shop: "無印良品", path: %r{\A/jp/ja/store/cmdty/detail/[0-9]+/?\z} },
      "www.muji.net" => { provider: "muji", shop: "無印良品", path: %r{\A/store/cmdty/detail/[0-9]+/?\z} }
    }.freeze

    class Error < StandardError; end

    def self.store(url)
      uri = URI.parse(url.to_s)
      store = STORES[uri.host]
      store if uri.scheme == "https" && uri.port == 443 && uri.userinfo.nil? && store && store[:path].match?(uri.path)
    rescue URI::InvalidURIError
      nil
    end

    def fetch(url)
      raise Error, "許可した公式商品詳細URLではありません" unless self.class.store(url)

      uri = URI.parse(url)
      raise Error, "robots.txtにより商品ページ取得が禁止されています" unless robots_allowed?(uri)

      response, resolved = request(uri)
      raise Error, "商品ページ取得失敗: HTTP #{response.code}" unless response.is_a?(Net::HTTPSuccess)
      raise Error, "商品ページがHTMLではありません" unless response["content-type"].to_s.include?("text/html")

      { html: response.body, url: resolved.to_s, store: self.class.store(resolved.to_s) }
    end

    private

    def request(uri, redirects: 0, robots: false)
      raise Error, "リダイレクト上限を超えました" if redirects > 3
      raise Error, "取得先ドメインが許可されていません" unless STORES.key?(uri.host) && uri.scheme == "https" && uri.port == 443 && uri.userinfo.nil?

      addresses = Resolv.getaddresses(uri.host)
      raise Error, "公開アドレスを確認できませんでした" if addresses.empty? || addresses.any? { |address| private_address?(address) }

      response = Timeout.timeout(15) do
        connection = Net::HTTP.new(uri.host, uri.port, nil)
        connection.use_ssl = true
        connection.open_timeout = 5
        connection.read_timeout = 8
        # Pin the checked address; TLS still verifies the original hostname.
        connection.ipaddr = addresses.first
        connection.start do |http|
          http.request(Net::HTTP::Get.new(uri.request_uri, "User-Agent" => USER_AGENT, "Accept" => "text/html")) do |result|
            body = +""
            result.read_body do |chunk|
              body << chunk
              raise Error, "商品ページが取得サイズ上限を超えました" if body.bytesize > MAX_BYTES
            end
            result.body = body
          end
        end
      end
      if response.is_a?(Net::HTTPRedirection)
        target = URI.join(uri, response["location"].to_s)
        raise Error, "商品詳細以外へのリダイレクトです" unless robots || self.class.store(target.to_s)
        raise Error, "移動先のrobots.txtにより取得が禁止されています" unless robots || robots_allowed?(target)

        return request(target, redirects: redirects + 1, robots:)
      end
      [ response, uri ]
    rescue SocketError, Resolv::ResolvError, Timeout::Error, IOError, SystemCallError, OpenSSL::SSL::SSLError => e
      raise Error, "公式ページへ接続できませんでした: #{e.class.name}"
    end

    def private_address?(address)
      ip = IPAddr.new(address)
      ip.private? || ip.loopback? || ip.link_local? || (ip.ipv4? && IPAddr.new("0.0.0.0/8").include?(ip)) ||
        (ip.ipv6? && (ip.to_i.zero? || ip.ipv4_mapped?))
    end

    def robots_allowed?(uri)
      @robots ||= {}
      @robot_failures ||= {}
      raise Error, @robot_failures[uri.host] if @robot_failures[uri.host]

      rules = @robots.fetch(uri.host) do
        response, = request(URI("https://#{uri.host}/robots.txt"), robots: true)
        raise Error, "robots.txtの取得が制限されています" if response.code.to_i == 403 || response.code.to_i >= 500
        raise Error, "robots.txtの取得結果を確認できませんでした" unless response.is_a?(Net::HTTPSuccess) || response.code.to_i == 404
        raise Error, "robots.txtがHTML応答のため許可を確認できませんでした" if response.is_a?(Net::HTTPSuccess) && response["content-type"].to_s.include?("text/html")

        @robots[uri.host] = response.code.to_i == 404 ? [] : robot_rules(response.body)
      end
      matches = rules.select { |rule| robot_match?(rule[:path], uri.request_uri) }
      longest = matches.max_by { |rule| [ rule[:path].delete("*$").length, rule[:allow] ? 1 : 0 ] }
      longest.nil? || longest[:allow]
    rescue Error => e
      # A blocked host must not consume the deadline again for every product URL.
      @robot_failures[uri.host] = e.message
      raise
    end

    def robot_rules(text)
      groups = []
      group = { agents: [], rules: [] }
      text.each_line do |line|
        key, value = line.split("#", 2).first.to_s.strip.split(":", 2).map(&:strip)
        next if value.nil?

        if key.downcase == "user-agent"
          if group[:rules].any?
            groups << group
            group = { agents: [], rules: [] }
          end
          group[:agents] << value.downcase
        elsif %w[allow disallow].include?(key.downcase) && value.present?
          group[:rules] << { path: value, allow: key.downcase == "allow" }
        end
      end
      groups << group
      specific = groups.select { |entry| entry[:agents].any? { |agent| agent != "*" && USER_AGENT.downcase.start_with?(agent) } }
      selected = specific.presence || groups.select { |entry| entry[:agents].include?("*") }
      selected.flat_map { |entry| entry[:rules] }
    end

    def robot_match?(pattern, path)
      regex = Regexp.escape(pattern).gsub('\\*', ".*").sub(/\\\$\z/, "$")
      Regexp.new("\\A#{regex}").match?(path)
    end
  end
end
