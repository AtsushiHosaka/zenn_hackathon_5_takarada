require "base64"
require "net/http"
require "timeout"
require "googleauth"

# Only text input: retailer images are never fetched or sent to the generator.
class GeminiImageClient
  DEFAULT_MODEL = "gemini-3.1-flash-image".freeze
  MAX_BYTES = 10.megabytes
  Response = Data.define(:bytes, :content_type, :model)
  class Error < StandardError; end

  def self.configured?(user_id: nil)
    ENV["FURNITURE_TEXTURES_ENABLED"] != "false" && GeminiClient.configured?(user_id: user_id)
  end

  attr_reader :model

  def initialize(provider: GeminiClient.provider, model: ENV["GEMINI_IMAGE_MODEL"].presence || DEFAULT_MODEL,
                 project: ENV["GOOGLE_CLOUD_PROJECT"], api_key: ENV["GEMINI_API_KEY"],
                 location: ENV["GEMINI_IMAGE_LOCATION"].presence)
    raise ArgumentError, "Invalid image model" unless model.match?(/\A[a-z0-9.-]+\z/)
    raise ArgumentError, "Invalid image provider" unless GeminiClient::PROVIDERS.include?(provider)

    @provider, @model, @api_key = provider, model, api_key
    @imagen = model.start_with?("imagen-")
    if provider == "vertex"
      raise ArgumentError, "Invalid Google Cloud project" unless project.to_s.match?(/\A[a-z][a-z0-9-]{4,28}[a-z0-9]\z|\A[0-9]+\z/)

      location ||= @imagen ? "us-central1" : "global"
      raise ArgumentError, "Invalid image location" unless location.match?(/\A[a-z0-9-]+\z/)
      raise ArgumentError, "Imagen requires a regional location" if @imagen && location == "global"

      host = location == "global" ? "aiplatform.googleapis.com" : "#{location}-aiplatform.googleapis.com"
      action = @imagen ? "predict" : "generateContent"
      @endpoint = URI("https://#{host}/v1/projects/#{project}/locations/#{location}/publishers/google/models/#{model}:#{action}")
    else
      raise ArgumentError, "Imagen requires Vertex provider" if @imagen
      raise ArgumentError, "Gemini API key is missing" if api_key.blank?

      @endpoint = URI("https://generativelanguage.googleapis.com/v1beta/models/#{model}:generateContent")
    end
  end

  def generate(prompt:, timeout: 35)
    raise Error, "image_generation_timeout" unless timeout.is_a?(Numeric) && timeout.to_f.finite? && timeout.positive?

    body = if @imagen
      { instances: [ { prompt: prompt } ], parameters: { sampleCount: 1, aspectRatio: "1:1", personGeneration: "dont_allow", outputOptions: { mimeType: "image/png" } } }
    else
      { contents: [ { role: "user", parts: [ { text: prompt } ] } ], generationConfig: { responseModalities: [ "TEXT", "IMAGE" ], imageConfig: { aspectRatio: "1:1" } } }
    end
    response = Timeout.timeout(timeout, Error, "image_generation_timeout") do
      Net::HTTP.start(@endpoint.host, @endpoint.port, use_ssl: true, open_timeout: 5, read_timeout: timeout, write_timeout: 10) do |http|
        http.post(@endpoint.path, body.to_json, headers)
      end
    end
    # Error bodies may contain submitted data; never include them in logs or responses.
    raise Error, "image_generation_http_#{response.code}" unless response.is_a?(Net::HTTPSuccess)

    json = JSON.parse(response.body)
    image = if @imagen
      Array(json["predictions"]).find { |entry| entry["bytesBase64Encoded"].present? }
    else
      Array(json["candidates"]).flat_map { |candidate| Array(candidate.dig("content", "parts")) }
        .filter_map { |part| part["inlineData"] }.find { |entry| entry["data"].present? }
    end
    raise Error, "image_generation_no_image" unless image

    mime = image["mimeType"]
    raise Error, "image_generation_unsupported_type" unless %w[image/png image/jpeg image/webp].include?(mime)

    encoded = image[@imagen ? "bytesBase64Encoded" : "data"]
    raise Error, "image_generation_too_large" if encoded.bytesize > MAX_BYTES * 4 / 3 + 4

    bytes = Base64.strict_decode64(encoded)
    raise Error, "image_generation_empty" if bytes.empty?
    raise Error, "image_generation_too_large" if bytes.bytesize > MAX_BYTES
    raise Error, "image_generation_invalid_bytes" unless valid_image?(bytes, mime)

    Response.new(bytes: bytes, content_type: mime, model: model)
  rescue JSON::ParserError, ArgumentError
    raise Error, "image_generation_invalid_response"
  end

  private

  def headers
    result = { "Content-Type" => "application/json" }
    if @provider == "vertex"
      @credentials ||= Google::Auth.get_application_default([ GeminiClient::SCOPE ])
      @credentials.apply!(result)
    else
      result["x-goog-api-key"] = @api_key
    end
    result
  end

  def valid_image?(bytes, mime)
    case mime
    when "image/png" then bytes.start_with?("\x89PNG\r\n\x1a\n".b)
    when "image/jpeg" then bytes.start_with?("\xff\xd8\xff".b)
    when "image/webp" then bytes.start_with?("RIFF") && bytes.byteslice(8, 4) == "WEBP"
    end
  end
end
