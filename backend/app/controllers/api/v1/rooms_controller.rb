module Api
  module V1
    # 部屋の登録と解析結果の取得。解析は AnalyzeRoomJob が非同期で行うので、
    # クライアントは GET で status が ready になるまでポーリングする。
    # 認証済みユーザーが所有する部屋・提案だけを扱う。
    class RoomsController < ApplicationController
      # GET /api/v1/rooms
      def index
        rooms = current_user.rooms.includes(:latest_coordination).order(created_at: :desc, id: :desc)
        render json: RoomSerializer.new(rooms)
      end

      # POST /api/v1/rooms
      def create
        room = current_user.rooms.new(room_params)
        missing = RoomPhoto.missing(room.photo_keys, user: current_user)
        return render json: { errors: [ "アップロードできていない写真があります" ] }, status: :unprocessable_entity if missing.any?

        if room.save
          AnalyzeRoomJob.perform_later(room.id)
          render json: RoomSerializer.new(room), status: :created
        else
          render json: { errors: room.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/rooms/:id
      def show
        render json: RoomSerializer.new(current_user.rooms.includes(:latest_coordination).find(params[:id]))
      end

      private

      def room_params
        params.require(:room).permit(:tatami, :shape, photo_keys: [])
      end
    end
  end
end
