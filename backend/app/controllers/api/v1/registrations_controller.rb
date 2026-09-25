module Api
  module V1
    # POST /api/v1/signup
    # User(プロフィール) と Identity(認証情報) をまとめて作り、そのままログインさせる。
    # devise.rb の jwt.dispatch_requests にこのパスを登録してあるので、
    # レスポンスの Authorization ヘッダに Bearer トークンが載る。
    class RegistrationsController < ApplicationController
      skip_before_action :authenticate_identity!, only: :create

      def create
        user = User.new(
          name: signup_params[:name],
          identity_attributes: {
            email: signup_params[:email],
            password: signup_params[:password]
          }
        )

        if user.save
          # API 専用でセッションを持たないので store: false
          sign_in(:identity, user.identity, store: false)
          render json: UserSerializer.new(user), status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def signup_params
        params.require(:user).permit(:name, :email, :password)
      end
    end
  end
end
