require "net/http"
require "ipaddr"
require "resolv"
require "timeout"

module InteriorLinks
  # Google-provided grounding redirect links are resolved without fetching the
  # destination. Only PageFetcher is allowed to retrieve actual EC pages.
  class GroundingSourceResolver
    HOST = "vertexaisearch.cloud.google.com".freeze
    MAX_SOURCES = 72
    CONCURRENCY = 8
    MAX_BYTES = 16 * 1024
    DEADLINE_SECONDS = 12
    class Error < StandardError; end

    def resolve(sources)
      fetcher = PageFetcher # Resolve Rails autoload on the caller before worker joins.
      sources = Array(sources).uniq
      selected = sources.first(MAX_SOURCES)
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      queue = Queue.new
      selected.each_with_index { |source, index| queue << [ source, index ] }
      # Only fixed Google redirect URLs are resolved here; official destinations
      # are still fetched and verified by PageFetcher in the catalog stage.
      workers = []
      [ selected.length, CONCURRENCY ].min.times do
        workers << Thread.new do
          rows = []
          loop do
            source, index = queue.pop(true)
            remaining = DEADLINE_SECONDS - (Process.clock_gettime(Process::CLOCK_MONOTONIC) - started)
            rows << [ index, resolve_one(source, remaining, fetcher) ]
          rescue ThreadError
            break
          end
          rows
        end
      end
      rows = workers.flat_map(&:value).sort_by(&:first).map(&:last)
      counts = rows.each_with_object(Hash.new(0)) { |row, totals| totals[row[:status]] += 1 }
      counts["source_limit"] = sources.length - selected.length if sources.length > selected.length
      { urls: rows.filter_map { |row| row[:url] }.uniq,
        diagnostics: counts.to_h.merge("source_count" => sources.length) }
    ensure
      workers&.each { |worker| worker.kill if worker.alive? }
      workers&.each(&:join)
    end

    private

    def resolve_one(source, remaining, fetcher)
      return { status: "deadline" } if remaining <= 0
      return { url: source, status: "direct_official" } if fetcher.store(source)
      return { status: "unsupported_source" } unless google_uri?(source)

      target = Timeout.timeout([ remaining, 5 ].min) { follow(URI(source)) }
      target ? { url: target, status: "resolved_official" } : { status: "non_product_destination" }
    rescue Error, URI::InvalidURIError, SocketError, Resolv::ResolvError, Timeout::Error, IOError, SystemCallError, OpenSSL::SSL::SSLError
      # Opaque source paths and response bodies must never enter logs/errors.
      { status: "resolution_failed" }
    end

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
