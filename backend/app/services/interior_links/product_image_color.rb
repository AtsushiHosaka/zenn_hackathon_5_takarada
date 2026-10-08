require "digest"

module InteriorLinks
  # One small image and a quantized histogram, with no model/API inference.
  class ProductImageColor
    SOURCE = "product_image_dominant_color_v1".freeze
    SAMPLE_SIDE = 96
    MAX_PIXELS = 40_000_000
    BACKGROUND_DISTANCE = 30

    def initialize(fetcher: nil)
      @fetcher = fetcher
    end

    def call(url:, provider:)
      return { "status" => "missing_image" } if url.blank?
      return { "status" => "unsupported_image_source" } unless ProductImageFetcher.allowed?(url, provider:)

      key = "#{SOURCE}/#{provider}/#{Digest::SHA256.hexdigest(url)}"
      cached = Rails.cache.read(key)
      return cached if cached

      result = extract(url, provider)
      Rails.cache.write(key, result, expires_in: result["color"] ? 1.day : 10.minutes)
      result
    end

    private

    def extract(url, provider)
      require "vips"
      bytes = (@fetcher || ProductImageFetcher.new).fetch(url, provider:)
      header = Vips::Image.new_from_buffer(bytes, "", access: :sequential, fail_on: :error)
      return { "status" => "invalid_image_size" } if header.width * header.height > MAX_PIXELS

      image = Vips::Image.thumbnail_buffer(bytes, SAMPLE_SIDE, height: SAMPLE_SIDE, size: :down, fail_on: :error)
        .colourspace(:srgb).cast(:uchar)
      pixels = image.write_to_memory.unpack("C*").each_slice(image.bands).to_a
      excluded = background_pixels(pixels, image.width, image.height)
      bins = Hash.new { |hash, key| hash[key] = [ 0, 0, 0, 0, 0 ] }
      pixels.each_with_index do |pixel, index|
        next if excluded[index] || (pixel.length > 3 && pixel[3] < 128)

        rgb = pixel.first(3)
        # Favor the product in the center over a border, stand or floor shadow.
        x, y = index % image.width, index / image.width
        weight = 1.0 + [ x, image.width - 1 - x, y, image.height - 1 - y ].min.to_f / [ image.width, image.height ].min
        bin = bins[rgb.map { |channel| channel / 32 }]
        bin[0] += weight
        3.times { |axis| bin[axis + 1] += rgb[axis] * weight }
        bin[4] += 1
      end
      dominant = bins.values.max_by(&:first)
      return { "status" => "no_foreground" } unless dominant && dominant[4] >= 8

      color = "#" + dominant[1, 3].map { |value| "%02x" % (value / dominant[0]).round }.join
      { "status" => "ready", "color" => color, "source" => SOURCE, "image_url" => url,
        "sample_size" => { "w" => image.width, "h" => image.height }, "dominant_pixels" => dominant[4] }
    rescue LoadError
      { "status" => "unavailable", "reason" => "libvips unavailable" }
    rescue ProductImageFetcher::Error, Vips::Error => error
      { "status" => "failed", "reason" => error.message.first(200) }
    end

    # Remove only an edge-connected, consistent background. Interior light
    # fabric remains eligible; if white furniture disappears, use its color name.
    def background_pixels(pixels, width, height)
      edges = pixels.each_index.select { |index| index < width || index >= width * (height - 1) || index % width == 0 || index % width == width - 1 }
      opaque = edges.select { |index| pixels[index].length == 3 || pixels[index][3] >= 128 }
      groups = opaque.group_by { |index| pixels[index].first(3).map { |channel| channel / 32 } }
      group = groups.values.max_by(&:length)
      return {} unless group && group.length >= opaque.length * 0.6

      background = 3.times.map { |axis| group.sum { |index| pixels[index][axis] }.to_f / group.length }
      matches = lambda do |index|
        pixel = pixels[index]
        (pixel.length > 3 && pixel[3] < 128) || 3.times.sum { |axis| (pixel[axis] - background[axis])**2 } <= BACKGROUND_DISTANCE**2
      end
      queue = edges.select { |index| matches.call(index) }
      excluded = queue.to_h { |index| [ index, true ] }
      offset = 0
      while offset < queue.length
        index = queue[offset]
        offset += 1
        neighbors = []
        neighbors << index - width if index >= width
        neighbors << index + width if index < width * (height - 1)
        neighbors << index - 1 if index % width > 0
        neighbors << index + 1 if index % width < width - 1
        neighbors.each do |neighbor|
          next if excluded[neighbor] || !matches.call(neighbor)

          excluded[neighbor] = true
          queue << neighbor
        end
      end
      excluded
    end
  end
end
