module Api
  module V1
    class FurnitureImportsController < ApplicationController
      def create
        result = FurnitureImport.call(url: params[:url], user_id: current_user.id, variant_id: params[:variant_id])
        render json: FurnitureImportSerializer.new(result), status: :created
      rescue FurnitureImport::Error => error
        render json: { errors: [ error.message ] }, status: :unprocessable_entity
      end
    end
  end
end
