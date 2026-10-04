# コーデ提案。要望と予算から商品を選び、配置後のシーンを after_scene に持つ
class Coordination < ApplicationRecord
  STATUSES = %w[pending processing done failed].freeze

  belongs_to :room

  validates :prompt, presence: true, length: { maximum: 500 }
  validates :budget, numericality: { only_integer: true, greater_than: 0 }
  validates :status, inclusion: { in: STATUSES }
end
