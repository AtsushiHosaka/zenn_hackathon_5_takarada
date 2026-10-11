# 商品の画像と寸法から、AI に 3D モデルを作らせる (管理画面の「3Dモデルを作る」)。
#
#   ModelGeneration.start(detail:, user:)  依頼を置き場に書き、生成のジョブを起動する
#   ModelGeneration.sync(generation)       ジョブの結果 (result.json) を取り込む。生成中のあいだ、画面が開くたびに呼ぶ
#   ModelGeneration.adopt(generation)      GLB を公開バケットへ複製し、家具と 3D モデルを作って商品に割り当てる
#
# 生成そのもの (AI の呼び出し・検査・組み立て・描画) は tools/furniture_models/generator のジョブが行う。
# ジョブはデータベースにも秘密の値にも触れず、MODEL_BUILDS_BUCKET の generations/<id>/ だけで API とやり取りする。
# 本番には裏で動く処理 (ワーカー) が無いので、結果は待たずに、画面からの問い合わせのたびに取り込む。
module ModelGeneration
  class Error < StandardError; end

  # これを過ぎても結果が無ければ失敗にする (ジョブの制限時間は 15 分)
  DEADLINE = 20.minutes

  def self.bucket
    ENV["MODEL_BUILDS_BUCKET"].presence || (Rails.env.local? ? "local-model-builds" : nil)
  end

  def self.asset(generation, name)
    Storage.asset(bucket, "#{generation.prefix}/#{name}") or raise Error, "3Dモデルの生成が設定されていません (MODEL_BUILDS_BUCKET)"
  end

  def self.start(detail:, user:)
    raise Error, "3Dモデルの生成が設定されていません" unless bucket && Runner.available?
    raise Error, "この商品は、いま3Dモデルを作っている途中です" if FurnitureModelGeneration.exists?(furniture_detail: detail, status: "running")

    request = { "name" => detail.name, "category" => detail.category, "size" => detail.size, "color" => detail.symbolic_color,
                "material" => detail.material, "image_url" => detail.image_url }
    generation = FurnitureModelGeneration.create!(furniture_detail: detail, user:, model_key: "ai_#{detail.id}_#{SecureRandom.hex(4)}", request:)
    begin
      Storage.client.store(asset(generation, "request.json"), request.merge("model_key" => generation.model_key).to_json, content_type: "application/json")
      Runner.start(generation)
    rescue StandardError => error
      generation.update!(status: "failed", error_message: "ジョブを起動できませんでした: #{error.message}".truncate(500), finished_at: Time.current)
    end
    generation
  end

  def self.sync(generation)
    return generation unless generation.status == "running"

    body = Storage.client.download(asset(generation, "result.json"))
    if body
      result = JSON.parse(body)
      status = result["status"] == "succeeded" ? "succeeded" : "failed"
      generation.update!(status:, result: result.slice("checks", "stats", "ai", "notes"), error_message: result["error"]&.truncate(1000), finished_at: Time.current)
    elsif generation.created_at < DEADLINE.ago
      generation.update!(status: "failed", error_message: "時間内に終わりませんでした。もう一度作り直してください", finished_at: Time.current)
    end
    generation
  rescue JSON::ParserError
    generation.update!(status: "failed", error_message: "ジョブの結果を読めませんでした", finished_at: Time.current)
    generation
  end

  # 管理画面へ出すファイル (確認用の画像と GLB)。無ければ nil
  def self.file(generation, name)
    FurnitureModelGeneration::FILES.key?(name) ? Storage.client.download(asset(generation, name)) : nil
  end

  def self.adopt(generation)
    raise Error, "採用できるのは、検査に合格して採用待ちの生成だけです" unless generation.status == "succeeded"

    stats = generation.result.fetch("stats")
    glb = Storage.client.download(asset(generation, "model.glb")) or raise Error, "GLB が見つかりません"
    raise Error, "GLB が検査したときの内容と違います" unless Digest::SHA256.hexdigest(glb) == stats["sha256"]

    detail = generation.furniture_detail
    models_bucket = ENV["MODELS_BUCKET"].presence || (Rails.env.local? ? "local-models" : nil) or raise Error, "MODELS_BUCKET が設定されていません"
    FurnitureModelGeneration.transaction do
      furniture = Furniture.create!(name: detail.name.truncate(60), category: detail.category)
      size = stats.fetch("size")
      model = Furniture3DModel.create!(
        # 形の種類 (chair_shell など) は今までのモデルから引き継ぐ。候補の振り分けと、形での検索に使うため
        furniture:, model_key: generation.model_key, shape: detail.furniture.model&.shape || generation.model_key, format: "glb",
        width: size["w"], height: size["h"], depth: size["d"], triangle_count: stats["triangles"], byte_size: stats["bytes"],
        sha256: stats["sha256"], color_material_keys: stats["materials"],
        # 寸法の出どころは商品なので、今までのモデルが持っていた推定の辺を引き継ぐ
        estimated_axes: detail.estimated_axes
      )
      detail.update!(furniture:, color_materials: { model.primary_color_key => detail.symbolic_color })
      generation.update!(status: "adopted")
      # 公開は最後。ここで失敗したら、家具・モデル・商品の変更もまとめて取り消す
      Storage.client.store(Storage.asset(models_bucket, model.object_key), glb, content_type: "model/gltf-binary")
    end
    generation
  end

  def self.reject(generation)
    raise Error, "不採用にできるのは、採用待ちか失敗の生成だけです" unless %w[succeeded failed].include?(generation.status)

    generation.update!(status: "rejected")
    generation
  end
end
