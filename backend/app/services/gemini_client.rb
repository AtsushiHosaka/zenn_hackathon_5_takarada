require "net/http"
require "timeout"
require "googleauth"

# Gemini API (Interactions API) の呼び出し口。画像を添えて、JSON Schema どおりの JSON を返させる。
# GEMINI_PROVIDER=vertex は GCP プロジェクトの ADC 認証、developer は従来の API キー認証。
# モデルと考える量は GEMINI_MODEL / GEMINI_THINKING_LEVEL で指定する。
class GeminiClient
  ENDPOINT = URI("https://generativelanguage.googleapis.com/v1beta/interactions")
  SCOPE = "https://www.googleapis.com/auth/cloud-platform".freeze
  PROVIDERS = %w[developer vertex].freeze
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
    return false if Rails.env.test?
    configured = if provider == "vertex"
      ENV["GOOGLE_CLOUD_PROJECT"].present?
    else
      ENV["GEMINI_API_KEY"].present?
    end
    return false unless configured

    allowed = ENV["GEMINI_ALLOWED_USER_IDS"]
    return true if allowed.nil?

    allowed == "*" || (user_id.present? && allowed.split(",").map(&:strip).include?(user_id.to_s))
  end

  def self.provider
    value = ENV["GEMINI_PROVIDER"].presence || "developer"
    raise ArgumentError, "GEMINI_PROVIDER は #{PROVIDERS.join(' / ')} のどれか" unless PROVIDERS.include?(value)

    value
  end

  def initialize(api_key: ENV["GEMINI_API_KEY"], provider: self.class.provider,
                 project: ENV["GOOGLE_CLOUD_PROJECT"], location: ENV["GOOGLE_CLOUD_LOCATION"].presence || "global",
                 model: ENV["GEMINI_MODEL"].presence || DEFAULT_MODEL,
                 thinking_level: ENV["GEMINI_THINKING_LEVEL"].presence)
    raise ArgumentError, "provider は #{PROVIDERS.join(' / ')} のどれか" unless PROVIDERS.include?(provider)
    raise ArgumentError, "thinking_level は #{THINKING_LEVELS.join(' / ')} のどれか" if thinking_level && !THINKING_LEVELS.include?(thinking_level)

    @provider = provider
    @endpoint = if provider == "vertex"
      raise ArgumentError, "GOOGLE_CLOUD_PROJECT にプロジェクト ID または番号を指定してください" unless project.to_s.match?(/\A[a-z][a-z0-9-]{4,28}[a-z0-9]\z|\A[0-9]+\z/)
      raise ArgumentError, "Vertex Interactions API の location は global のみです" unless location == "global"

      URI("https://aiplatform.googleapis.com/v1beta1/projects/#{project}/locations/global/interactions")
    else
      raise ArgumentError, "GEMINI_API_KEY が設定されていません" if api_key.blank?

      ENDPOINT
    end
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
    if @provider == "vertex"
      body[:response_format] = schema
      body[:response_mime_type] = "application/json"
    end
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
    response = Net::HTTP.start(@endpoint.host, @endpoint.port, use_ssl: true, open_timeout: 5, read_timeout: 25, write_timeout: 20) do |http|
      http.post(@endpoint.path, body.to_json, headers)
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

  def headers
    result = { "Content-Type" => "application/json" }
    if @provider == "vertex"
      # apply! は期限が切れたアクセストークンを更新する。キー認証への代替経路は持たない。
      @credentials ||= Google::Auth.get_application_default([ SCOPE ])
      @credentials.apply!(result)
    else
      result["x-goog-api-key"] = @api_key
    end
    result
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
