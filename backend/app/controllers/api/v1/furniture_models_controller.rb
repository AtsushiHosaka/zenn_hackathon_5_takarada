module Api
  module V1
    class FurnitureModelsController < ApplicationController
      skip_before_action :authenticate_identity!

      def index
        render json: FurnitureModelSerializer.new(Furniture3DModel.joins(:furniture).merge(Furniture.available).includes(furniture: { characters: :franchise }).order(:model_key))
      end

      def show
        render json: FurnitureModelSerializer.new(Furniture3DModel.joins(:furniture).merge(Furniture.available).includes(furniture: { characters: :franchise }).find_by!(model_key: params[:id]))
      end
    end
  end
end
