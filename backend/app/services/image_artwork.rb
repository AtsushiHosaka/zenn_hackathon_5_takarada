require "base64"

# User images stay in authenticated scenes, never as arbitrary remote URLs.
class ImageArtwork
  PREFIX = "data:image/png;base64,".freeze
  MAX_LENGTH = 262_144

  def self.valid?(value)
    return false unless value.is_a?(Hash) && value.keys == [ "data_url" ]
    data = value["data_url"]
    return false unless data.is_a?(String) && data.bytesize <= MAX_LENGTH && data.start_with?(PREFIX)

    png = Base64.strict_decode64(data.delete_prefix(PREFIX))
    return false unless png.bytesize >= 33 && png.start_with?("\x89PNG\r\n\x1a\n".b) && png.byteslice(12, 4) == "IHDR"

    png.byteslice(16, 8).unpack("NN").all? { |dimension| dimension.between?(1, 512) }
  rescue ArgumentError
    false
  end
end
