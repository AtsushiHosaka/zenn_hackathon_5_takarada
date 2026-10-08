require "delegate"

# Make verified user choices available to the planner; its later instructions can
# still remove or replace a choice. Never override its final selection afterward.
class FurnitureSelectedProductClient < SimpleDelegator
  def initialize(client, products)
    super(client)
    @products = products
  end

  def search(**params)
    results = __getobj__.search(**params)
    selected = @products.select do |item|
      Array(params[:slots]).include?(item.slot) && item.price <= params[:max_price] &&
        (item.slot != "floor" || Array(params[:categories]).empty? || Array(params[:categories]).include?(item.category))
    end
    (selected + results.values.flatten).uniq { |item| [ item.metadata["group_id"], item.id ] }.group_by(&:slot)
  end
end
