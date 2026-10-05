class FurnitureTexture < ApplicationRecord
  validates :generation_key, presence: true, uniqueness: true, format: { with: /\A[0-9a-f]{64}\z/ }
  validates :bucket, :object_key, :generator_model, :material_name, :source_description, presence: true
  validates :tile_size_m, numericality: { greater_than: 0, less_than_or_equal_to: 10 }

  def asset
    Storage.asset(bucket, object_key)
  end
end
