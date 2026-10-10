module Api
  module V1
    module Admin
      # 3D モデルの一覧 (無効なものも含む) と、有効・無効の切り替え。
      # GLB と寸法は db/furnitures.json が正で、ここでは変えない
      class FurnitureModelsController < BaseController
        # GET /api/v1/admin/furniture_models
        def index
          models = Furniture3DModel.includes(furniture: :details).order(:model_key)
          render json: AdminFurnitureModelSerializer.new(models)
        end

        # PATCH /api/v1/admin/furniture_models/:id (:id はモデル ID)
        def update
          model = Furniture3DModel.includes(furniture: :details).find_by!(model_key: params[:id])
          enabled = ActiveModel::Type::Boolean.new.cast(params.dig(:furniture_model, :enabled))
          raise ActionController::ParameterMissing, :enabled if enabled.nil?

          model.furniture.update!(enabled:)
          render json: AdminFurnitureModelSerializer.new(model)
        end
      end
    end
  end
end
