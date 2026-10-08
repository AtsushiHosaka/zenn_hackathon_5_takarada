require "net/http"
require "ipaddr"
require "resolv"
require "timeout"

module InteriorLinks
  # Image locations are restricted to the product CDNs observed on each store's pages.
  class ProductImageFetcher
    MAX_BYTES = 2 * 1024 * 1024
    MAX_SECONDS = 4
    IMAGE_TYPES = %w[image/jpeg image/png image/webp].freeze
    SOURCES = {
      "ikea" => { "www.ikea.com" => %r{\A/jp/ja/images/products/} },
      "nitori" => { "www.nitori-net.jp" => %r{\A/ecstatic/image/product/} },
      "francfranc" => { "francfranc.com" => %r{\A/cdn/shop/(?:files|products)/} },
      "yahoo_shopping" => { "item-shopping.c.yimg.jp" => %r{\A/i/} }
    }.freeze
    NON_PUBLIC_IPV4 = %w[0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16
                        172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 192.88.99.0/24 192.168.0.0/16
                        198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4].map { |range| IPAddr.new(range) }.freeze
    PUBLIC_IPV6 = IPAddr.new("2000::/3")
    NON_PUBLIC_IPV6 = %w[2001::/23 2001:db8::/32 2002::/16 3fff::/20].map { |range| IPAddr.new(range) }.freeze

    class Error < StandardError; end

    def self.allowed?(url, provider:)
      uri = URI.parse(url.to_s)
      path = SOURCES.fetch(provider.to_s, {})[uri.host]
      !!(uri.scheme == "https" && uri.port == 443 && uri.userinfo.nil? && path && path.match?(uri.path))
    rescue URI::InvalidURIError
      false
    end

    def fetch(url, provider:)
      Timeout.timeout(MAX_SECONDS) do
        request(URI.parse(url.to_s), provider:)
      end
    rescue URI::InvalidURIError, SocketError, Resolv::ResolvError, Timeout::Error, IOError, Net::ProtocolError,
           SystemCallError, OpenSSL::SSL::SSLError => e
      raise Error, "商品画像へ接続できませんでした: #{e.class.name}"
    end

    private

    def request(uri, provider:, redirects: 0)
      raise Error, "画像のリダイレクト上限を超えました" if redirects > 3
      raise Error, "商品画像の取得先が許可されていません" unless self.class.allowed?(uri.to_s, provider:)

      addresses = Resolv.getaddresses(uri.host)
      raise Error, "商品画像の公開アドレスを確認できませんでした" if addresses.empty? || addresses.any? { |address| non_public?(address) }

      connection = Net::HTTP.new(uri.host, uri.port, nil)
      connection.use_ssl = true
      connection.open_timeout = 2
      connection.read_timeout = 2
      connection.max_retries = 0
      # Connect to the validated address while retaining TLS hostname verification.
      connection.ipaddr = addresses.first
      response = connection.start do |http|
        http.request(Net::HTTP::Get.new(uri.request_uri, "User-Agent" => PageFetcher::USER_AGENT,
                                                       "Accept" => IMAGE_TYPES.join(", "), "Accept-Encoding" => "identity")) do |result|
          unless result.is_a?(Net::HTTPRedirection)
            raise Error, "商品画像取得失敗: HTTP #{result.code}" unless result.is_a?(Net::HTTPSuccess)
            raise Error, "対応していない商品画像形式です" unless IMAGE_TYPES.include?(result["content-type"].to_s.split(";").first.to_s.strip.downcase)
          end
          raise Error, "商品画像が取得サイズ上限を超えました" if result["content-length"].to_i > MAX_BYTES

          body = +"".b
          result.read_body do |chunk|
            raise Error, "商品画像が取得サイズ上限を超えました" if body.bytesize + chunk.bytesize > MAX_BYTES

            body << chunk
          end
          result.body = body
        end
      end
      if response.is_a?(Net::HTTPRedirection)
        return request(URI.join(uri, response["location"].to_s), provider:, redirects: redirects + 1)
      end
      raise Error, "商品画像のデータ形式を確認できませんでした" unless image_bytes?(response.body)

      response.body
    end

    def non_public?(address)
      ip = IPAddr.new(address)
      if ip.ipv4?
        NON_PUBLIC_IPV4.any? { |range| range.include?(ip) }
      else
        !PUBLIC_IPV6.include?(ip) || NON_PUBLIC_IPV6.any? { |range| range.include?(ip) }
      end
    rescue IPAddr::InvalidAddressError
      true
    end

    def image_bytes?(bytes)
      bytes.start_with?("\xFF\xD8\xFF".b, "\x89PNG\r\n\x1A\n".b) ||
        (bytes.start_with?("RIFF") && bytes.byteslice(8, 4) == "WEBP")
    end
  end
end
