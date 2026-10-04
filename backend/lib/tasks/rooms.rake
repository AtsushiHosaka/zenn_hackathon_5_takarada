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
