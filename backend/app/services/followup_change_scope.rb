# 追加の指示から、今回変える範囲だけを決める。商品も配置も選ばない。
# 範囲に入らなかった家具・配置・色は FollowupCoordinationBuilder が前回のまま残す。
# 対象を特定できない指示は、部屋を変えずに聞き返す (Unclear)。
class FollowupChangeScope
  class Unclear < StandardError; end

  UNCLEAR = "どの家具を、交換・削除・追加のどれにするかを具体的に指定してください。".freeze
  SCHEMA = {
    type: "object", properties: {
      full_redesign: { type: "boolean" }, clarification: { type: "string" },
      wall_color: { type: "string" }, floor_color: { type: "string" },
      operations: { type: "array", items: { type: "object", properties: {
        object_id: { type: "string" }, action: { type: "string", enum: %w[replace remove] }
      }, required: %w[object_id action] } },
      add_slots: { type: "array", items: { type: "string", enum: CoordinationPlanner::SLOT_PRIORITY } },
      add_categories: { type: "array", items: { type: "string", enum: FurnitureCandidates::FLOOR_CATEGORIES } }
    }, required: %w[full_redesign clarification wall_color floor_color operations add_slots add_categories]
  }.freeze
  PROMPT = <<~TEXT.freeze
    インテリアの提案への追加の指示から、今回変える範囲だけをJSONで返してください。商品や配置は選びません。
    ここに挙げなかった家具・配置・壁と床の色は、前回のまま残ります。

    # 追加の指示
    %<prompt>s

    # これまでの要望 (文脈の参考。今回の指示に無い変更はしない)
    %<previous>s

    # 現在の部屋 (source: existing は元からある家具、suggested は提案した商品)
    %<scene>s

    # 決め方
    - 家具・商品の交換と削除は operations に、現在の部屋にある正確な id で指定する。
    - 「これ」「それ」のように対象が言葉から決まらない、同じ種類が複数あって1つに決まらないときは、何も変えず clarification に質問を書く。
    - 色や雰囲気を変える指示 (「落ち着いた色に」「もっと明るく」など) は、配置も家具の種類も変えない。色や雰囲気が指示に合わない商品だけを operations に replace で挙げ、すでに合っている物は挙げない。
    - 新しく足す指示だけ add_slots (布もの・壁飾り・照明・小物の枠) か add_categories (床に置く大型家具) に入れる。今ある物の変更を追加にしない。
    - add_slots と add_categories には、指示に出てくる種類だけを入れる。頼まれていない種類を足さない。
    - 足すだけの指示では operations を空にする。足す物に合わせて今ある物を替えない。指示に名前が出ていない家具・商品は、色や雰囲気を全体に変える指示のときを除いて operations に入れない。
    - 壁・床の色は、壁・床を変える指示か、部屋全体の色や雰囲気を変える指示のときだけ wall_color / floor_color に #RRGGBB で入れる。変えないほうは空文字。参考にできる配色: %<palette>s
    - 全体を作り直す指示 (「全部やり直して」「最初から別の案で」) がはっきりあるときだけ full_redesign を true にする。
    - 家具の移動や塗り替えなど、上の形で表せない指示は clarification で具体化を求める。問題なければ clarification は空文字。
    - clarification は利用者への短い質問にする。id という言葉は使わず、家具や商品の名前で尋ねる。
  TEXT
  LABELS = {
    "sofa" => /ソファ/, "bed" => /ベッド/, "desk" => /デスク|机/, "chair" => /椅子|チェア/,
    "shelf" => /棚/, "table" => /テーブル/, "rug" => /ラグ/, "curtain" => /カーテン/,
    "cushion" => /クッション/, "blanket" => /ブランケット/, "bed_cover" => /ベッドカバー|布団カバー/,
    "wall_decor" => /壁飾り|ポスター/, "light" => /照明|ライト|ランプ/, "display" => /飾り棚|観葉植物/, "desk_top" => /小物/
  }.freeze

  # forced: 画面で指定された操作 ({ "operations" => [...], "add_categories" => [...] })。AI の判断に足す
  def self.call(coordination, scene, forced: {})
    scope = if GeminiClient.configured?(user_id: coordination.room.user_id)
      GeminiClient.new.generate_json(schema: SCHEMA, prompt: prompt(coordination, scene)).json
    else
      mock(coordination.prompt, scene)
    end
    raise Unclear, UNCLEAR unless scope.is_a?(Hash)

    scope = normalize(scope, scene)
    scope["operations"] = (Array(forced["operations"]) + scope["operations"]).uniq { |operation| operation["object_id"] }
    scope["add_categories"] += Array(forced["add_categories"])
    return scope if scope["full_redesign"]

    changed = scope.values_at("wall_color", "floor_color").any?(&:present?) || %w[operations add_slots add_categories].any? { |key| scope[key].any? }
    raise Unclear, scope["clarification"].presence || UNCLEAR unless changed

    scope
  end

  def self.prompt(coordination, scene)
    palette = RoomPalette.find(coordination.room_palette_id) || CharacterRoomTheme.find(coordination.character_theme_id)
    objects = scene["objects"].map do |object|
      object.slice("id", "label", "category", "slot", "source", "color", "attach_to").merge("color_word" => FurnitureCandidates::Colors.word(object["color"])).compact
    end
    format(PROMPT, prompt: coordination.prompt, previous: coordination.base_coordination.prompt,
                   scene: { room: scene["room"].slice("wall_color", "floor_color"), objects: }.to_json,
                   palette: palette ? "壁 #{palette.fetch('base')} / 床 #{palette.fetch('secondary')}" : "なし")
  end

  # AI の回答から、形の合うものだけを残す。現在の部屋に無い id は捨てる
  def self.normalize(scope, scene)
    ids = scene["objects"].pluck("id")
    color = ->(value) { value.is_a?(String) && value.match?(/\A#[0-9a-f]{6}\z/i) ? value : "" }
    {
      "full_redesign" => scope["full_redesign"] == true,
      "clarification" => scope["clarification"].to_s.strip,
      "wall_color" => color.call(scope["wall_color"]), "floor_color" => color.call(scope["floor_color"]),
      "operations" => Array(scope["operations"]).select { |operation| operation.is_a?(Hash) && ids.include?(operation["object_id"]) && %w[replace remove].include?(operation["action"]) }
        .map { |operation| operation.slice("object_id", "action") }.uniq { |operation| operation["object_id"] },
      "add_slots" => Array(scope["add_slots"]) & CoordinationPlanner::SLOT_PRIORITY,
      "add_categories" => Array(scope["add_categories"]).select { |category| FurnitureCandidates::FLOOR_CATEGORIES.include?(category) }
    }
  end

  # AI を使わないときの簡易な読み取り。種類の言葉と、足す・替える・外すの言葉だけを見る
  def self.mock(prompt, scene)
    scope = { "full_redesign" => /全体.*(?:作り直|再提案|やり直)|全部.*(?:作り直|やり直)|最初から/.match?(prompt), "clarification" => "",
              "wall_color" => "", "floor_color" => "", "operations" => [], "add_slots" => [], "add_categories" => [] }
    matches = LABELS.select { |_, pattern| pattern.match?(prompt) }.keys
    matches.delete("bed") if matches.include?("bed_cover")
    matches.each do |name|
      objects = scene["objects"].select { |object| object["category"] == name || object["slot"] == name }
      if /追加|足し|増やし|置い/.match?(prompt) && !/替え|変え|交換/.match?(prompt)
        scope[FurnitureCandidates::FLOOR_CATEGORIES.include?(name) ? "add_categories" : "add_slots"] << name
      elsif objects.one?
        scope["operations"] << { "object_id" => objects.first["id"], "action" => /外し|消し|いらない|なくし|撤去/.match?(prompt) ? "remove" : "replace" }
      elsif objects.empty?
        scope[FurnitureCandidates::FLOOR_CATEGORIES.include?(name) ? "add_categories" : "add_slots"] << name
      else
        scope["clarification"] = "#{objects.map { |object| object['label'] }.join('、')}のうち、どれを変えるかを指定してください。"
      end
    end
    scope
  end
end
