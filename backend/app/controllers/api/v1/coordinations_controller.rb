module Api
  module V1
    # コーデ提案の作成と取得。生成は GenerateCoordinationJob が非同期で行うので、
    # クライアントは GET で status が done / failed になるまでポーリングする。
    # 認証済みユーザーが所有する部屋・提案だけを扱う。
    class CoordinationsController < ApplicationController
      # POST /api/v1/rooms/:room_id/coordinations
      def create
        room = current_user.rooms.find(params[:room_id])
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
        render json: CoordinationSerializer.new(current_user.coordinations.includes(:room).find(params[:id]))
      end

      private

      def coordination_params
        params.require(:coordination).permit(:prompt, :budget, :base_coordination_id, :room_palette_id, kept_object_ids: [],
                                                    furniture_operations: [ :object_id, :action ], additions: [ :category ],
                                                    edited_objects: [ :id, :label, :category, :ec_product_id, :rotation_y, :color, position: [ :x, :y, :z ], size: [ :w, :h, :d ] ])
      end
    end
  end
end
