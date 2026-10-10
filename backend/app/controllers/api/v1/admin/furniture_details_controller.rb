module Api
  module V1
    module Admin
      # 商品 (家具の色・寸法・購入リンク) の一覧・作成・編集と、db/furniture_details.json の形での書き出し。
      # ここで保存した detail は admin_edited_at が入り、furniture_detail:import に上書きされない
      class FurnitureDetailsController < BaseController
        # GET /api/v1/admin/furniture_details : 非表示のものも含む全件
        def index
          details = FurnitureDetail.includes(furniture: :model, detail_textures: :furniture_texture).order(:slot, :position, :id)
          render json: { details: AdminFurnitureDetailSerializer.new(details).serializable_hash,
                         slots: FurnitureCandidates::SLOTS, categories: FurnitureSearch::CATEGORIES }
        end

        # POST /api/v1/admin/furniture_details
        def create
          save(FurnitureDetail.new(key: "admin:#{SecureRandom.uuid}"), :created)
        end

        # PATCH /api/v1/admin/furniture_details/:id
        def update
          save(FurnitureDetail.find(params[:id]), :ok)
        end

        # GET /api/v1/admin/furniture_details/export : db/furniture_details.json にそのまま置ける JSON
        def export
          render json: FurnitureDetailExporter.call
        end

        private

        def save(detail, status)
          attributes = detail_params
          size = attributes.delete(:size).to_h
          model_key = attributes.delete(:model_key)
          detail.assign_attributes(attributes)
          detail.assign_attributes(width: size["w"], height: size["h"], depth: size["d"]) if size.present?
          if model_key
            detail.furniture = Furniture3DModel.find_by(model_key:)&.furniture
            return render json: { errors: [ "3Dモデル #{model_key} が見つかりません" ] }, status: :unprocessable_entity unless detail.furniture
          end
          detail.admin_edited_at = Time.current
          if detail.save
            render json: AdminFurnitureDetailSerializer.new(detail), status:
          else
            render json: { errors: detail.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def detail_params
          params.require(:furniture_detail).permit(
            :name, :category, :slot, :model_key, :symbolic_color, :color_name, :price, :shop, :url, :image_url, :position, :enabled,
            color_materials: {}, size: %i[w h d], themes: []
          ).to_h.symbolize_keys
        end
      end
    end
  end
end
