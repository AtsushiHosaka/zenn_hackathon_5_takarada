# 部屋。写真を解析したシーン (部屋の外形 + 今ある家具) を scene に持つ
class Room < ApplicationRecord
  STATUSES = %w[analyzing ready failed].freeze
  # 部屋の形 => 幅 / 奥行き の比
  SHAPE_RATIOS = { "square" => 1 / 1.15, "standard" => 3 / 4.0, "long" => 1 / 2.0 }.freeze

  belongs_to :user, optional: true # Preserve legacy anonymous records.

  has_many :coordinations, dependent: :destroy

  # DB の既定値は既存行の補完用。新規作成では必須にするため既定値を外す
  attribute :shape, :string, default: nil

  validates :tatami, numericality: { greater_than_or_equal_to: 3, less_than_or_equal_to: 30 }
  validates :shape, inclusion: { in: SHAPE_RATIOS.keys }
  validates :status, inclusion: { in: STATUSES }

  def ready?
    status == "ready"
  end

  # 解析の LLM へは gs:// で渡す (Storage::Asset#uri)
  def photo_assets
    photo_keys.map { |key| RoomPhoto.asset(key) }
  end
end
