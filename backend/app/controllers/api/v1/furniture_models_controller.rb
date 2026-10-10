module Api
  module V1
    class FurnitureModelsController < ApplicationController
      skip_before_action :authenticate_identity!

      def index
        render json: FurnitureModelSerializer.new(Furniture.available.includes(:bindings).order(:model_key))
      end

      def show
        render json: FurnitureModelSerializer.new(Furniture.available.includes(:bindings).find_by!(model_key: params[:id]))
      end
    end
  end
end
