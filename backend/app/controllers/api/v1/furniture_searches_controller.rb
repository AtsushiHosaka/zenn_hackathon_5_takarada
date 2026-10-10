module Api
  module V1
    class FurnitureSearchesController < ApplicationController
      def create
        result = FurnitureSearch.call(query: params[:query], color: params[:color], category: params[:category])
        render json: FurnitureSearchSerializer.new(result)
      rescue FurnitureSearch::Error => error
        render json: { errors: [ error.message ] }, status: :unprocessable_entity
      end
    end
  end
end
