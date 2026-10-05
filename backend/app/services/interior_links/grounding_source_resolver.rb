require "net/http"
require "ipaddr"
require "resolv"
require "timeout"

module InteriorLinks
  # Google-provided grounding redirect links are resolved without fetching the
  # destination. Only PageFetcher is allowed to retrieve actual EC pages.
  class GroundingSourceResolver
    HOST = "vertexaisearch.cloud.google.com".freeze
    MAX_SOURCES = 24
    MAX_BYTES = 16 * 1024
    DEADLINE_SECONDS = 15
    class Error < StandardError; end

    def resolve(sources)
      accepted = []
      counts = Hash.new(0)
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      sources.uniq.first(MAX_SOURCES).each do |source|
        remaining = DEADLINE_SECONDS - (Process.clock_gettime(Process::CLOCK_MONOTONIC) - started)
        if remaining <= 0
          counts["deadline"] += 1
          break
        end
        if PageFetcher.store(source)
          accepted << source
          counts["direct_official"] += 1
          next
        end
        unless google_uri?(source)
          counts["unsupported_source"] += 1
          next
        end
        begin
          target = Timeout.timeout([ remaining, 5 ].min) { follow(URI(source)) }
          if target
            accepted << target
            counts["resolved_official"] += 1
          else
            counts["non_product_destination"] += 1
          end
        rescue Error, URI::InvalidURIError, SocketError, Resolv::ResolvError, Timeout::Error, IOError, SystemCallError, OpenSSL::SSL::SSLError
          # Opaque source paths and response bodies must never enter logs/errors.
          counts["resolution_failed"] += 1
        end
      end
      { urls: accepted.uniq, diagnostics: counts.to_h.merge("source_count" => sources.uniq.length) }
    end

    private

    def google_uri?(url)
      uri = URI(url.to_s)
      uri.scheme == "https" && uri.host == HOST && uri.port == 443 && uri.userinfo.nil? && uri.query.nil? && uri.fragment.nil? &&
        uri.path.match?(%r{\A/grounding-api-redirect/[A-Za-z0-9_=-]+\z})
    rescue URI::InvalidURIError
      false
    end

    def follow(uri, redirects: 0)
      raise Error, "redirect_limit" if redirects > 2
      raise Error, "invalid_source" unless google_uri?(uri.to_s)

      addresses = Resolv.getaddresses(HOST)
      raise Error, "non_public_address" if addresses.empty? || addresses.any? { |address| private_address?(address) }

      connection = Net::HTTP.new(HOST, 443, nil)
      connection.use_ssl = true
      connection.ipaddr = addresses.first
      connection.open_timeout = 2
      connection.read_timeout = 3
      response = connection.start do |http|
        http.request(Net::HTTP::Get.new(uri.request_uri, "User-Agent" => PageFetcher::USER_AGENT)) do |result|
          total = 0
          result.read_body do |chunk|
            total += chunk.bytesize
            raise Error, "response_limit" if total > MAX_BYTES
          end
        end
      end
      raise Error, "unexpected_response" unless response.is_a?(Net::HTTPRedirection)

      target = URI.join(uri, response["location"].to_s)
      return target.to_s if PageFetcher.store(target.to_s)
      return follow(target, redirects: redirects + 1) if google_uri?(target.to_s)

      nil
    end

    def private_address?(address)
      ip = IPAddr.new(address)
      ip.private? || ip.loopback? || ip.link_local? || (ip.ipv4? && IPAddr.new("0.0.0.0/8").include?(ip)) ||
        (ip.ipv6? && (ip.to_i.zero? || ip.ipv4_mapped?))
    end
  end
end
