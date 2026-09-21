module Api
  module V1
    # POST   /api/v1/login   : トークン発行 (devise.rb の jwt.dispatch_requests)
    # DELETE /api/v1/logout  : トークン失効 (devise.rb の jwt.revocation_requests)
    #
    # 失効は identities.jti を打ち直すことで行う (Identity の JTIMatcher)。
    # 実際に Authorization ヘッダを載せる/剥がすのは Warden の Rack ミドルウェア。
    class SessionsController < ApplicationController
      skip_before_action :authenticate_identity!, only: :create

      def create
        identity = Identity.find_by(email: login_params[:email].to_s.strip.downcase)

        unless identity&.valid_password?(login_params[:password])
          return render json: { error: "メールアドレスまたはパスワードが違います" },
                        status: :unauthorized
        end

        # API 専用でセッションを持たないので store: false
        sign_in(:identity, identity, store: false)
        render json: serialize_user(identity.user)
      end

      def destroy
        sign_out(current_identity)
        head :no_content
      end

      private

      def login_params
        params.require(:identity).permit(:email, :password)
      end
    end
  end
end
