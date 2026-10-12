module Api
  module V1
    module Admin
      # AI に商品の 3D モデルを作らせる。作る → 確認用の画像と検査の結果を見る → 採用か不採用かを選ぶ。
      # 生成は数分かかり、専用のジョブが行う (ModelGeneration)。生成中の状態は、取得のたびに結果を取り込んで更新する
      class ModelGenerationsController < BaseController
        rescue_from ModelGeneration::Error do |error|
          render json: { errors: [ error.message ] }, status: :unprocessable_entity
        end

        # GET /api/v1/admin/furniture_details/:furniture_detail_id/model_generations : その商品の生成を新しい順に
        def index
          generations = FurnitureModelGeneration.where(furniture_detail_id: params[:furniture_detail_id]).order(id: :desc).limit(20)
          generations.each { |generation| ModelGeneration.sync(generation) }
          render json: AdminModelGenerationSerializer.new(generations)
        end

        # POST /api/v1/admin/furniture_details/:furniture_detail_id/model_generations : 生成を始める
        def create
          generation = ModelGeneration.start(detail: FurnitureDetail.find(params[:furniture_detail_id]), user: current_user)
          render json: AdminModelGenerationSerializer.new(generation), status: :created
        end

        # GET /api/v1/admin/model_generations/:id
        def show
          render json: AdminModelGenerationSerializer.new(ModelGeneration.sync(generation))
        end

        # POST /api/v1/admin/model_generations/:id/adopt : 商品の 3D モデルとして採用する
        def adopt
          render json: AdminModelGenerationSerializer.new(ModelGeneration.adopt(generation))
        end

        # POST /api/v1/admin/model_generations/:id/reject : 不採用にする (記録は残る)
        def reject
          render json: AdminModelGenerationSerializer.new(ModelGeneration.reject(generation))
        end

        # GET /api/v1/admin/model_generations/:id/files/:name : 確認用の画像 (front.png・side.png) と GLB (model.glb)
        def file
          name = "#{params[:name]}.#{params[:format]}"
          bytes = ModelGeneration.file(generation, name) or return head :not_found
          send_data bytes, type: FurnitureModelGeneration::FILES.fetch(name), disposition: "inline"
        end

        private

        def generation
          @generation ||= FurnitureModelGeneration.find(params[:id])
        end
      end
    end
  end
end
