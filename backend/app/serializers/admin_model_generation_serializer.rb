# 管理画面用の、AI による 3D モデル生成 1 回分の表現
class AdminModelGenerationSerializer
  include Alba::Resource

  attributes :id, :furniture_detail_id, :model_key, :status, :error_message
  # AI が書いた、形の捉え方のメモ
  attribute(:notes) { |generation| generation.result["notes"] }
  # 検査の一覧 ({ name, ok, detail })
  attribute(:checks) { |generation| Array(generation.result["checks"]) }
  # 三角形数・部位・ファイルの大きさなど (組み立てられたときだけ)
  attribute(:stats) { |generation| generation.result["stats"] }
  # AI の呼び出し回数・時間・トークン数
  attribute(:ai) { |generation| generation.result["ai"] }
  # 取得できるファイル名 (files/:name)
  attribute(:files) { |generation| generation.result["stats"] ? FurnitureModelGeneration::FILES.keys : [] }
  attribute(:created_at) { |generation| generation.created_at.iso8601 }
  attribute(:finished_at) { |generation| generation.finished_at&.iso8601 }
end
