class ApplicationController < ActionController::API
  # JWT の検証自体は Warden (devise-jwt) の Rack ミドルウェアが済ませている。
  # ここは「認証済みでなければ 401」を全エンドポイントの既定にするためのもの。
  # 公開エンドポイントは各コントローラで skip_before_action する。
  before_action :authenticate_identity!

  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from ActionController::ParameterMissing, with: :render_bad_request

  private

  # devise が :identity スコープの current_identity を生やす
  def current_user
    current_identity&.user
  end

  def serialize_user(user)
    {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at.iso8601,
      updated_at: user.updated_at.iso8601
    }
  end

  def render_not_found(exception)
    render json: { error: exception.message }, status: :not_found
  end

  def render_bad_request(exception)
    render json: { error: exception.message }, status: :bad_request
  end
end
