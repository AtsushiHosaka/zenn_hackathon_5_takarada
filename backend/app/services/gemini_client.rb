require "net/http"

# Gemini API (Interactions API) の呼び出し口。画像を添えて、JSON Schema どおりの JSON を返させる。
# API キーは環境変数 GEMINI_API_KEY (backend/.env)。モデルは GEMINI_MODEL (既定 gemini-3.8-flash)。
class GeminiClient
  ENDPOINT = URI("https://generativelanguage.googleapis.com/v1beta/interactions")
  DEFAULT_MODEL = "gemini-3.8-flash".freeze
  RETRYABLE = [ 429, 500, 502, 503, 504 ].freeze

  class Error < StandardError; end

  def self.configured?
    ENV["GEMINI_API_KEY"].present?
  end

  def initialize(api_key: ENV.fetch("GEMINI_API_KEY"), model: ENV.fetch("GEMINI_MODEL", DEFAULT_MODEL))
    @api_key = api_key
    @model = model
  end

  # images: [{ mime_type: "image/jpeg", data: バイナリ }, ...]
  def generate_json(prompt:, schema:, images: [])
    body = {
      model: @model,
      # 送った写真を Google 側に保存させない
      store: false,
      input: [
        { type: "text", text: prompt },
        *images.map { |image| { type: "image", mime_type: image[:mime_type], data: Base64.strict_encode64(image[:data]) } }
      ],
      response_format: { type: "text", mime_type: "application/json", schema: }
    }
    parse(post(body))
  end

  private

  def post(body, attempt: 1)
    response = Net::HTTP.start(ENDPOINT.host, ENDPOINT.port, use_ssl: true, open_timeout: 10, read_timeout: 180) do |http|
      http.post(ENDPOINT.path, body.to_json, "Content-Type" => "application/json", "x-goog-api-key" => @api_key)
    end
    return response if response.is_a?(Net::HTTPSuccess)

    # 混雑・一時的な失敗は 1 回だけ待ってやり直す
    if RETRYABLE.include?(response.code.to_i) && attempt < 2
      sleep 3
      return post(body, attempt: attempt + 1)
    end
    raise Error, "Gemini API がエラーを返しました (#{response.code}): #{error_message(response)}"
  end

  def parse(response)
    json = JSON.parse(response.body)
    raise Error, "Gemini の生成が完了しませんでした (status: #{json['status']})" unless json["status"] == "completed"

    text = Array(json["steps"]).select { |step| step["type"] == "model_output" }
                               .flat_map { |step| Array(step["content"]) }
                               .select { |content| content["type"] == "text" }
                               .sum("") { |content| content["text"].to_s }
    JSON.parse(text)
  rescue JSON::ParserError
    raise Error, "Gemini の応答を JSON として読めませんでした"
  end

  # エラーは { error: { message: } } か、それを配列で包んだ形で返ってくる
  def error_message(response)
    body = JSON.parse(response.body)
    body = body.first if body.is_a?(Array)
    body.dig("error", "message").to_s.truncate(200)
  rescue JSON::ParserError, TypeError, NoMethodError
    response.body.to_s.truncate(200)
  end
end
