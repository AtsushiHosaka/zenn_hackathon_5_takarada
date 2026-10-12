# 推し活グッズの種別 (= furnitures.category) の辞書。config/goods_categories.json
module GoodsCategories
  ROWS = JSON.parse(File.read(Rails.root.join("config/goods_categories.json"))).fetch("categories").index_by { |row| row.fetch("category") }.freeze

  def self.find(category)
    ROWS[category]
  end

  def self.categories
    ROWS.keys
  end
end
