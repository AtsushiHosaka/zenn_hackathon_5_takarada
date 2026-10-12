# AI に 3D モデルを作らせた 1 回分の記録。進め方は ModelGeneration (サービス) が持つ
class FurnitureModelGeneration < ApplicationRecord
  STATUSES = %w[running succeeded failed adopted rejected].freeze
  # ジョブが置くファイル (result.json は取り込み用。管理画面へ出すのは下の 3 つ)
  FILES = { "front.png" => "image/png", "side.png" => "image/png", "model.glb" => "model/gltf-binary" }.freeze

  belongs_to :furniture_detail
  belongs_to :user

  validates :model_key, presence: true, uniqueness: true, format: { with: Furniture3DModel::KEY_PATTERN }
  validates :status, inclusion: { in: STATUSES }

  # ジョブとの受け渡しに使う置き場のパス (バケット内)
  def prefix
    "generations/#{id}"
  end
end
