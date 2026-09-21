module Api
  module V1
    # 作成は POST /api/v1/signup (RegistrationsController) が担当する。
    # email / パスワードの変更は identities 側の責務なのでここでは扱わない。
    class UsersController < ApplicationController
      before_action :set_user, only: %i[show update destroy]

      # GET /api/v1/users
      def index
        users = User.includes(:identity).order(id: :asc)
        render json: users.map { |user| serialize_user(user) }
      end

      # GET /api/v1/users/:id
      def show
        render json: serialize_user(@user)
      end

      # PATCH/PUT /api/v1/users/:id
      def update
        if @user.update(user_params)
          render json: serialize_user(@user)
        else
          render json: { errors: @user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/users/:id
      def destroy
        @user.destroy!
        head :no_content
      end

      private

      def set_user
        @user = User.find(params[:id])
      end

      def user_params
        params.require(:user).permit(:name)
      end
    end
  end
end
