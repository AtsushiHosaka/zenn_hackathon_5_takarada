module Api
  module V1
    # 部屋の登録と解析結果の取得。解析は AnalyzeRoomJob が非同期で行うので、
    # クライアントは GET で status が ready になるまでポーリングする。
    # ハッカソンのデモ用にログイン不要の公開エンドポイントにしている
    class RoomsController < ApplicationController
      skip_before_action :authenticate_identity!

      # POST /api/v1/rooms
      def create
        room = Room.new(room_params)
        if room.save
          AnalyzeRoomJob.perform_later(room.id)
          render json: RoomSerializer.new(room), status: :created
        else
          render json: { errors: room.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/rooms/:id
      def show
        render json: RoomSerializer.new(Room.find(params[:id]))
      end

      private

      def room_params
        params.require(:room).permit(:tatami, :shape)
      end
    end
  end
end
