module Api
  module V1
    # 部屋の登録と解析結果の取得。解析は AnalyzeRoomJob が非同期で行うので、
    # クライアントは GET で status が ready になるまでポーリングする。
    # 認証済みユーザーが所有する部屋・提案だけを扱う。
    class RoomsController < ApplicationController
      # GET /api/v1/rooms
      def index
        rooms = current_user.rooms.includes(:latest_coordination).order(id: :desc)
        render json: RoomSerializer.new(rooms)
      end

      # POST /api/v1/rooms
      def create
        attributes = room_params
        template = attributes.delete(:template_scene)
        room = current_user.rooms.new(attributes)
        from_template = params.require(:room).key?(:template_scene)
        if from_template
          raise RoomTemplateScene::Invalid, "テンプレートと写真を同時に指定できません" if room.photo_keys.any?
          scene = RoomTemplateScene.call(template.respond_to?(:to_h) ? template.to_h : template)
          room.assign_attributes(scene:, status: "ready", analyzed_by: nil, analysis: { "source" => "template" })
        end
        missing = RoomPhoto.missing(room.photo_keys, user: current_user)
        return render json: { errors: [ "アップロードできていない写真があります" ] }, status: :unprocessable_entity if missing.any?

        if room.save
          AnalyzeRoomJob.perform_later(room.id) unless from_template
          render json: RoomSerializer.new(room), status: :created
        else
          render json: { errors: room.errors.full_messages }, status: :unprocessable_entity
        end
      rescue RoomTemplateScene::Invalid => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      # GET /api/v1/rooms/:id
      def show
        render json: RoomSerializer.new(current_user.rooms.includes(:latest_coordination).find(params[:id]))
      end

      private

      def room_params
        params.require(:room).permit(:tatami, :shape, photo_keys: [], template_scene: [
          { room: [ :width, :depth, :height, :wall_color, :floor_color,
                    { windows: [ :id, :wall, :center, :width, :bottom, :height ] } ],
            objects: [ :id, :source, :category, :label, :rotation_y, :color, :model_url,
                       { position: [ :x, :y, :z ], size: [ :w, :h, :d ] } ] }
        ])
      end
    end
  end
end
