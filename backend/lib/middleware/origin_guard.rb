# API Gateway が付与する x-origin-secret ヘッダを検証する Rack ミドルウェア。
# Lightsail の 3000 番は全公開せざるを得ない (API Gateway に固定 IP が無い) ため、
# IP を直接叩かれたリクエストをここで弾く。
#
# ORIGIN_SECRET が未設定なら何もしない (ローカル開発では無効)。
class OriginGuard
  def initialize(app)
    @app = app
  end

  def call(env)
    secret = ENV["ORIGIN_SECRET"].to_s
    return @app.call(env) if secret.empty?

    given = env["HTTP_X_ORIGIN_SECRET"].to_s
    return @app.call(env) if ActiveSupport::SecurityUtils.secure_compare(given, secret)

    [ 403, { "content-type" => "application/json" }, [ { error: "forbidden" }.to_json ] ]
  end
end
