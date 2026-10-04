# 部屋の写真の解析 (Gemini) の精度を確かめるための道具。
namespace :rooms do
  desc "解析結果 (Gemini の生の回答と家具の置き方) を表示する  例: bin/rails 'rooms:report[51]'"
  task :report, [ :id ] => :environment do |_, args|
    puts RoomAnalysisReport.new(Room.find(args.fetch(:id)))
  end

  desc "保存してある写真で解析し直して表示する (SAVE=1 で結果を部屋に保存)  例: bin/rails 'rooms:reanalyze[51,low]'"
  task :reanalyze, [ :id, :thinking_level, :model ] => :environment do |_, args|
    room = Room.find(args.fetch(:id))
    abort "部屋 ##{room.id} には写真がありません" if room.photo_keys.empty?
    abort "GEMINI_API_KEY が設定されていません (backend/.env)" unless GeminiClient.configured?

    options = { thinking_level: args[:thinking_level].presence, model: args[:model].presence }.compact
    result = RoomAnalyzer.new(room, gemini: options).call
    puts RoomAnalysisReport.new(room, analysis: result.analysis, analyzed_by: result.analyzed_by)

    if ENV["SAVE"] == "1"
      room.update!(scene: result.scene, analyzed_by: result.analyzed_by, analysis: result.analysis, status: "ready", error_message: nil)
      puts "\n部屋 ##{room.id} に保存しました"
    end
  end
end

namespace :coordinations do
  desc "コーデの商品選び (Gemini の回答と、予算・置き場所で実際に採用した商品) を表示する  例: bin/rails 'coordinations:report[198]'"
  task :report, [ :id ] => :environment do |_, args|
    c = Coordination.find(args.fetch(:id))
    meta = c.analysis.to_h["meta"].to_h
    puts "コーデ ##{c.id} (部屋 ##{c.room_id})  #{c.status}  選び方: #{c.planned_by || '-'}  #{meta['model']} #{meta['elapsed_s']}秒"
    puts "要望: #{c.prompt}  予算: #{c.budget.to_fs(:delimited)}円  活かす家具: #{c.kept_object_ids.presence&.join(', ') || '全部'}"
    puts "タイトル: #{c.title}\nコメント: #{c.comment}\n\n"

    placed = c.analysis.to_h["placed_item_ids"].to_a
    picks = c.analysis.to_h.dig("response", "picks").to_a
    if picks.any?
      puts "Gemini が選んだ候補 (★ = 採用)"
      catalog = InteriorLinks.client.search(theme: nil, slots: InteriorLinks::SLOTS, max_price: Float::INFINITY).values.flatten.index_by(&:id)
      picks.each do |pick|
        names = pick["item_ids"].map { |id| "#{placed.include?(id) ? '★' : ''}#{catalog[id]&.name || "不明な id #{id}"}" }
        puts "  #{pick['slot'].ljust(10)} #{names.join(' / ')}"
      end
    end
    puts "\n採用: " + c.items.map { |i| "#{i['name']} (¥#{i['price']}・#{i['placement_note']})" }.join(" / ") + "  合計 ¥#{c.total_price}"
  end
end
