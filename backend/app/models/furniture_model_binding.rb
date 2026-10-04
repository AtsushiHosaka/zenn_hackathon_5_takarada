class FurnitureModelBinding < ApplicationRecord
  KINDS = %w[existing product].freeze

  belongs_to :furniture_model
  validates :kind, inclusion: { in: KINDS }
  validates :reference, presence: true, uniqueness: { scope: :kind }
  validates :reference, format: { with: /\A[1-9][0-9]*\z/ }, if: -> { kind == "product" }
end
