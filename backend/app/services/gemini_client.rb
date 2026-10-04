require "net/http"
require "timeout"

# Gemini API (Interactions API) の呼び出し口。画像を添えて、JSON Schema どおりの JSON を返させる。
# API キーは環境変数 GEMINI_API_KEY (backend/.env)。モデルは GEMINI_MODEL (既定 gemini-3.1-flash-lite)、
# 考える量は GEMINI_THINKING_LEVEL (low / medium / high。未設定ならモデルの既定)。
class GeminiClient
  ENDPOINT = URI("https://generativelanguage.googleapis.com/v1beta/interactions")
  # 部屋の写真の解析で比べた結果、3.8 Flash より速く (約 100 秒 → 約 3 秒)・安く・混雑しにくく、
  # 位置関係の精度も劣らなかった (specs/room-coordination/spec.md)
  DEFAULT_MODEL = "gemini-3.1-flash-lite".freeze
  THINKING_LEVELS = %w[minimal low medium high].freeze
  RETRYABLE = [ 429, 500, 502, 503, 504 ].freeze
  REQUEST_DEADLINE_SECONDS = 90

  class Error < StandardError; end

  # json: 生成された JSON / usage: トークン数 / elapsed: かかった秒数 (やり直しを含む)
  Response = Data.define(:json, :model, :thinking_level, :usage, :elapsed)

  # テストでは本物の Gemini を呼ばない (手元の backend/.env にキーがあってもモックで動かす)
  # Secretを限定検証するときは、サーバーが持つ部屋のowner IDだけで判定する。
  # 未設定は従来のキー判定、空は全員mock、*は一般利用の明示許可。
  def self.configured?(user_id: nil)
    return false unless ENV["GEMINI_API_KEY"].present? && !Rails.env.test?

    allowed = ENV["GEMINI_ALLOWED_USER_IDS"]
    return true if allowed.nil?

    allowed == "*" || (user_id.present? && allowed.split(",").map(&:strip).include?(user_id.to_s))
  end

  def initialize(api_key: ENV.fetch("GEMINI_API_KEY"), model: ENV["GEMINI_MODEL"].presence || DEFAULT_MODEL,
                 thinking_level: ENV["GEMINI_THINKING_LEVEL"].presence)
    raise ArgumentError, "thinking_level は #{THINKING_LEVELS.join(' / ')} のどれか" if thinking_level && !THINKING_LEVELS.include?(thinking_level)

    @api_key = api_key
    @model = model
    @thinking_level = thinking_level
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
    body[:generation_config] = { thinking_level: @thinking_level } if @thinking_level
    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    json, usage = Timeout.timeout(REQUEST_DEADLINE_SECONDS, Error, "AIの生成が時間内に完了しませんでした。少し待ってから再度お試しください") do
      parse(post(body))
    end
    elapsed = (Process.clock_gettime(Process::CLOCK_MONOTONIC) - started).round(1)
    Response.new(json:, model: @model, thinking_level: @thinking_level, usage:, elapsed:)
  end

  private

  def post(body, attempt: 1)
    response = Net::HTTP.start(ENDPOINT.host, ENDPOINT.port, use_ssl: true, open_timeout: 5, read_timeout: 25, write_timeout: 20) do |http|
      http.post(ENDPOINT.path, body.to_json, "Content-Type" => "application/json", "x-goog-api-key" => @api_key)
    end
    return response if response.is_a?(Net::HTTPSuccess)

    # 混雑 (429・503 など) は一時的なことが多いので、間隔を空けて 2 回までやり直す (2 秒 → 6 秒)
    if RETRYABLE.include?(response.code.to_i) && attempt < 3
      Rails.logger.info("Gemini #{response.code}: #{attempt} 回目が失敗したのでやり直します")
      sleep 2 * (3**(attempt - 1))
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
    usage = json["usage"].to_h.slice("total_input_tokens", "total_output_tokens", "total_thought_tokens", "total_tokens")
    [ JSON.parse(text), usage ]
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
