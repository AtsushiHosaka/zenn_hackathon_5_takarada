module Api
  module V1
    # GET /api/v1/me : トークンの持ち主を返す
    class MeController < ApplicationController
      def show
        render json: serialize_user(current_user)
      end
    end
  end
end
