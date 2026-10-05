class EcProduct < ApplicationRecord
  # The offset keeps persisted real products separate from legacy mock product IDs.
  PUBLIC_ID_OFFSET = 1_000_000_000

  validates :provider, :provider_product_id, :variant_id, presence: true

  def product_id
    PUBLIC_ID_OFFSET + id
  end
end
