# 部屋の解析結果を、精度の確認用に読みやすく表示する (rake rooms:report / rooms:reanalyze から使う)。
# 解析の生の回答 (observation) と、それを RoomLayout がどう置いたか (layout) を並べる。
class RoomAnalysisReport
  # 有料枠の価格 (USD / 100 万トークン)。考えた分 (thought) は出力として数える。
  # gemini-3.8-flash は 2026 年中の導入価格 (2027 年から倍)
  PRICES = {
    "gemini-3.1-flash-lite" => { input: 0.25, output: 1.50 },
    "gemini-3.8-flash" => { input: 0.75, output: 3.75 }
  }.freeze
  YEN_PER_USD = 150

  RESULTS = {
    "wall" => "壁沿い (指定どおり)",
    "shifted" => "壁沿い (ずらした)",
    "other_wall" => "別の壁沿い",
    "floor" => "床へ (どの壁にも置けず)",
    "center" => "床へ (壁に付いていない)",
    "dropped" => "置けず (捨てた)",
    "ignored" => "対象外の種類"
  }.freeze

  def initialize(room, analysis: room.analysis, analyzed_by: room.analyzed_by)
    @room = room
    @analysis = analysis || {}
    @analyzed_by = analyzed_by
  end

  def to_s
    [ header, meta, colors_and_windows, furniture, photos ].compact.join("\n\n")
  end

  private

  def header
    "部屋 ##{@room.id}  #{@room.tatami.to_f}畳・#{@room.shape}  写真 #{@room.photos.size} 枚  解析: #{@analyzed_by || '-'}" \
      "  (#{@analysis['analyzed_at'] || '記録なし'})"
  end

  def meta
    meta = @analysis["meta"] || {}
    return "解析の記録がありません (analysis 列が追加される前に解析した部屋です。rooms:reanalyze で解析し直せます)" if meta.empty?
    return "モック (写真か GEMINI_API_KEY が無い)" if meta["analyzer"] == "mock"

    usage = meta["usage"] || {}
    input = usage["total_input_tokens"].to_i
    output = usage["total_output_tokens"].to_i + usage["total_thought_tokens"].to_i
    price = PRICES[meta["model"]]
    cost = price ? "有料枠なら約 #{((input * price[:input] + output * price[:output]) / 1_000_000 * YEN_PER_USD).round(2)} 円" : "価格不明"
    "モデル: #{meta['model']}  考える量: #{meta['thinking_level'] || '既定'}  時間: #{meta['elapsed_s']} 秒\n" \
      "トークン: 入力 #{input} / 出力 #{usage['total_output_tokens'].to_i} / 思考 #{usage['total_thought_tokens'].to_i}" \
      "  (#{cost})  送った画像: #{(meta['image_bytes'].to_i / 1024.0).round} KB"
  end

  def colors_and_windows
    observation = @analysis["observation"] || {}
    windows = Array(observation["windows"]).map { |w| "#{w['wall']}/#{w['position']}/#{w['size']}" }
    "壁の色: #{observation['wall_color']}  床の色: #{observation['floor_color']}\n窓: #{windows.presence&.join(', ') || 'なし'}"
  end

  def furniture
    observation = Array(@analysis.dig("observation", "furniture"))
    layout = Array(@analysis["layout"])
    lines = [ "家具 (Gemini の回答 #{observation.size} 件 → 置いた結果)" ]
    observation.each do |item|
      log = layout.find { |entry| entry["label"] == item["label"] && entry["category"] == item["category"] } || {}
      size = %w[width_m height_m depth_m].map { |key| item[key] }.join("×")
      result = RESULTS.fetch(log["result"], log["result"] || "-")
      result += " #{log['shift_m']}m" if log["result"] == "shifted"
      result += " (#{log['wall']})" if log["result"] == "other_wall"
      placed = log["placed"] ? " → (#{log['placed']['x']}, #{log['placed']['z']})" : ""
      lines << format("  %-14s %-9s 指定 %-6s %-7s %-14s %s  %s%s",
                      item["label"], item["category"], item["wall"], item["position"], size, item["color"], result, placed)
    end
    lines.join("\n")
  end

  def photos
    paths = @room.photos.map { |photo| ActiveStorage::Blob.service.path_for(photo.key).delete_prefix("#{Rails.root}/") }
    "写真: #{paths.join(', ')}" if paths.any?
  end
end
