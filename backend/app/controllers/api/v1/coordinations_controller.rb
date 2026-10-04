module Api
  module V1
    # コーデ提案の作成と取得。生成は GenerateCoordinationJob が非同期で行うので、
    # クライアントは GET で status が done / failed になるまでポーリングする。
    # ハッカソンのデモ用にログイン不要の公開エンドポイントにしている
    class CoordinationsController < ApplicationController
      skip_before_action :authenticate_identity!

      # POST /api/v1/rooms/:room_id/coordinations
      def create
        room = Room.find(params[:room_id])
        unless room.ready?
          return render json: { errors: [ "部屋の解析が終わっていません" ] }, status: :unprocessable_entity
        end

        coordination = room.coordinations.new(coordination_params)
        if coordination.save
          GenerateCoordinationJob.perform_later(coordination.id)
          render json: CoordinationSerializer.new(coordination), status: :created
        else
          render json: { errors: coordination.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/coordinations/:id
      def show
        render json: CoordinationSerializer.new(Coordination.includes(:room).find(params[:id]))
      end

      private

      def coordination_params
        params.require(:coordination).permit(:prompt, :budget, kept_object_ids: [])
      end
    end
  end
end
