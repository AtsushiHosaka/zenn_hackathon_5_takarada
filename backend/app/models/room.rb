# 部屋。写真を解析したシーン (部屋の外形 + 今ある家具) を scene に持つ
class Room < ApplicationRecord
  STATUSES = %w[analyzing ready failed].freeze
  MAX_PHOTOS = 4
  MAX_PHOTO_BYTES = 10.megabytes
  PHOTO_TYPES = %w[image/jpeg image/png image/webp].freeze
  # 部屋の形 => 幅 / 奥行き の比
  SHAPE_RATIOS = { "square" => 1 / 1.15, "standard" => 3 / 4.0, "long" => 1 / 2.0 }.freeze

  has_many :coordinations, dependent: :destroy
  has_many_attached :photos

  # DB の既定値は既存行の補完用。新規作成では必須にするため既定値を外す
  attribute :shape, :string, default: nil

  validates :tatami, numericality: { greater_than_or_equal_to: 3, less_than_or_equal_to: 30 }
  validates :shape, inclusion: { in: SHAPE_RATIOS.keys }
  validates :status, inclusion: { in: STATUSES }
  validate :validate_photos

  def ready?
    status == "ready"
  end

  private

  # 写真は任意 (無ければ畳数と部屋の形だけで解析する)。付けるなら 4 枚まで・JPEG/PNG/WebP・1 枚 10MB まで
  def validate_photos
    return unless photos.attached?

    errors.add(:photos, "は#{MAX_PHOTOS}枚までにしてください") if photos.size > MAX_PHOTOS
    errors.add(:photos, "は JPEG・PNG・WebP にしてください") unless (uploaded_photo_types - PHOTO_TYPES).empty?
    photos.each do |photo|
      errors.add(:photos, "は1枚#{MAX_PHOTO_BYTES / 1.megabyte}MB以下にしてください") if photo.byte_size > MAX_PHOTO_BYTES
    end
  end

  # 送られてきたファイルの種類を中身 (先頭のバイト列) から判定する。
  # ActiveStorage は中身で判定できないとき送信側の申告をそのまま使うため、画像でないファイルも通ってしまう
  def uploaded_photo_types
    Array(attachment_changes["photos"]&.attachables).filter_map do |attachable|
      next unless attachable.respond_to?(:tempfile)

      Marcel::MimeType.for(Pathname(attachable.tempfile.path))
    end
  end
end
