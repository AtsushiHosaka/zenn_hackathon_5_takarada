module Api
  module V1
    # 「この家具、似合ってる？」。画面が送った今の配置について答えるだけで、保存はしない
    class FurnitureReviewsController < ApplicationController
      def create
        input = params.permit(:prompt, target: [ :name, :category, :color, :existing, :on_floor, :furniture_detail_id, size: %i[w h d] ],
                                       room: %i[width depth wall_color floor_color], others: [ :name, :category, :color, :existing, :on_floor, size: %i[w h d] ])
        render json: FurnitureReviewSerializer.new(FurnitureReview.call(input:, user_id: current_user.id))
      rescue FurnitureReview::Error => error
        render json: { errors: [ error.message ] }, status: :unprocessable_entity
      rescue GeminiClient::Error => error
        Rails.logger.warn("FurnitureReview: #{error.message}")
        render json: { errors: [ "AIが今は答えられません。少し待ってからもう一度お試しください" ] }, status: :service_unavailable
      end
    end
  end
end
