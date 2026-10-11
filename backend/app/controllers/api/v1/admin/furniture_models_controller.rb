module Api
  module V1
    module Admin
      # 3D モデルの一覧 (無効なものも含む)・登録と更新・有効と無効の切り替えと、db/furnitures.json の形での書き出し。
      # 3D モデルは DB が正。GLB は先に公開バケットへ置き、ここでは寸法・ハッシュなどの情報だけを受け取る
      class FurnitureModelsController < BaseController
        # GET /api/v1/admin/furniture_models
        def index
          models = Furniture3DModel.preload(furniture: :details).order(:model_key)
          render json: AdminFurnitureModelSerializer.new(models)
        end

        # PUT /api/v1/admin/furniture_models/:id (:id はモデル ID) : 無ければ作り、あれば上書きする。有効・無効は変えない
        def upsert
          model = FurnitureImporter.upsert(model_params.merge("id" => params[:id], "format" => "glb",
                                                              "object_key" => Furniture3DModel.object_key_for(params[:id])))
          render json: AdminFurnitureModelSerializer.new(Furniture3DModel.preload(furniture: :details).find(model.id))
        rescue FurnitureImporter::InvalidManifest => error
          render json: { errors: [ error.message ] }, status: :unprocessable_entity
        end

        # PATCH /api/v1/admin/furniture_models/:id (:id はモデル ID)
        def update
          model = Furniture3DModel.preload(furniture: :details).find_by!(model_key: params[:id])
          enabled = ActiveModel::Type::Boolean.new.cast(params.dig(:furniture_model, :enabled))
          raise ActionController::ParameterMissing, :enabled if enabled.nil?

          model.furniture.update!(enabled:)
          render json: AdminFurnitureModelSerializer.new(model)
        end

        # GET /api/v1/admin/furniture_models/export : db/furnitures.json にそのまま置ける JSON
        def export
          render json: FurnitureExporter.call
        end

        private

        def model_params
          params.require(:furniture_model).permit(
            :name, :category, :shape, :variant, :triangles, :bytes, :sha256, size: [], color_material_keys: [], characters: []
          ).to_h
        end
      end
    end
  end
end
