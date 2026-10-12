module Api
  module V1
    module Admin
      # 管理画面用の API の共通部分。管理者 (users.admin) 以外は 403
      class BaseController < ApplicationController
        before_action :require_admin!

        private

        def require_admin!
          render json: { error: "管理者だけが使えます" }, status: :forbidden unless current_user&.admin?
        end
      end
    end
  end
end
