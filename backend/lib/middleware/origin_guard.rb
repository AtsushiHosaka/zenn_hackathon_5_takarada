# 手前のプロキシが付与する x-origin-secret ヘッダを検証する Rack ミドルウェア。
# オリジンを直接叩かれたリクエストを弾くための仕組み。
#
# ORIGIN_SECRET が未設定なら何もしない。現構成 (Cloud Run が直接受ける) では
# 設定していないので素通しになる。
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
