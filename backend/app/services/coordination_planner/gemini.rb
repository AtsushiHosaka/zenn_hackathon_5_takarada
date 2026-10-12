class CoordinationPlanner
  # 操作ごとの候補を保持して、色・素材・用途が合う一式と代替順位を選ぶ。
  # id/group/slotと置き場所はRubyで再確認する。
  class Gemini
    CANDIDATES_PER_GROUP = 12
    RANKED_PER_GROUP = 6
    SCHEMA = {
      type: "object",
      properties: {
        title: { type: "string", description: "コーデの名前 (20 文字以内。例: 水色の推し活ルーム)" },
        concept: { type: "string", description: "方向性の説明 (80 文字以内・です/ます調)。商品名は書かない" },
        unavailable_note: { type: "string", description: "要望どおりの色・雰囲気の商品が候補に無いときの断り書き (無ければ空文字)" },
        remove_object_ids: {
          type: "array", items: { type: "string" },
          description: "要望で「いらない」「外したい」「捨てる」とはっきり書かれた今ある家具の id。書かれていなければ空"
        },
        picks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slot: { type: "string", enum: FurnitureCandidates::SLOTS },
              group_id: { type: "string", description: "候補にあるgroup_id。床の追加・交換は各操作を別グループとして扱う" },
              selected_item_ids: { type: "array", items: { type: "integer" }, description: "この一式で購入する商品id。採用しないグループは空" },
              item_ids: { type: "array", items: { type: "integer" }, description: "この一式と相性がよい配置用の代替候補をおすすめ順に最大6件" }
            },
            required: %w[group_id slot selected_item_ids item_ids]
          }
        }
      },
      required: %w[title concept unavailable_note remove_object_ids picks]
    }.freeze

    SLOT_LABELS = {
      "bed_cover" => "ベッドカバー", "blanket" => "ブランケット", "curtain" => "カーテン", "rug" => "ラグ", "wall_decor" => "壁飾り",
      "light" => "照明", "display" => "飾り棚・大きめの飾り", "cushion" => "クッション", "desk_top" => "デスクの上の小物", "floor" => "追加・入れ替え用の大型家具"
    }.freeze

    PROMPT = <<~TEXT.freeze
      あなたはインテリアコーディネーターです。複数の商品候補から、要望・テンプレートの雰囲気に合う一式を選びます。
      残す家具は維持します。寸法と用途も確認しますが、最終的な配置は別の処理で判定します。

      # 要望
      %<prompt>s

      # 部屋
      - 壁の色: %<wall_color>s / 床の色: %<floor_color>s (かっこ内はおおよその色名)
      - 寸法 (m): %<room_size>s
      - 今ある家具 (id・名前・寸法・配置): %<kept>s

      # 商品候補 (JSON。寸法はm)
      sizeは配置する寸法、published_sizeは公開寸法 (nullは不明)、estimated_axesは描画用の推定軸です。推定値を公式寸法として説明しないでください。
      shapeは3Dモデルの形の種類 (chair_office・stool_round・rug_roundなど)、themesは合う雰囲気です。
      colorは3D表示用の代表色、color_wordはそのおおよその色名です。商品の実際の色はcolor_nameと商品名で判断してください。color_wordだけを根拠に希望色の商品があると断定しないでください。
      %<items>s

      # 選び方
      - 採用する商品をgroup_idごとにselected_item_idsへ指定する。上限は %<max_picks>s、それ以外のgroup_idは1点。
      - 点数は部屋の広さ・今ある家具・要望に合わせて決める。上限や全グループを埋めることを目的にせず、まとまりのある一式にする。同じ商品を2回入れない。
      - desk_top (デスクやテーブルの上の小物) は、雰囲気が合うものなら多めに選んでよい。
      - group_idがfloorの候補は、部屋にまだ無い種類の大型家具。デスクに椅子が無いなど足りない家具があるときや、要望に役立つときに足す。床の空きが少ない部屋や、物を増やしたくない要望では選ばない。
      - 要望・テンプレートの色調、素材、形、用途と、壁・床・残す家具との相性を一式として評価する。
      - replace:<家具ID>とadd:<番号>はユーザーが指定した床家具の用途。これらを優先し、同じSKUでも別group_idなら別の購入点数として扱う。
      - 床家具の候補はcategoryとgroup_idを必ず一致させる。交換はtarget_size/元の位置を参照し、部屋に対して大きすぎる候補は避ける。
      - 各グループのitem_idsは、この一式と素材・色・用途が合う代替候補をおすすめ順に最大6件指定する。合わない商品を候補へ加えない。
      - 候補にあるgroup_id/slot/idの組だけを使う。採用しないグループはselected_item_idsを空にするかpicksから省く。無理に埋めない。
      - picksは指定された床家具を先に、その後はこの提案で重要なグループの順に並べる。
      - 要望の色や雰囲気そのものの商品が無いときは、近い色・雰囲気の商品を選び、unavailable_note で
        「赤い商品が見つからなかったため、近い色の○○を選びました」のように正直に伝える。あれば空文字にする。
      - 今ある家具の色と、壁・床の色とも合うようにする。
      - キャラクターテーマは部屋全体の配色と用途で表現する。キャラクター名の付いた商品だけに絞らず、色と実用性が合う通常の家具・布小物を中心に、グッズをアクセントとして組み合わせる。
      - charactersは商品に紐づくキャラクターID。空の通常家具も採用できる。selected_by_userの商品はユーザーの選択として扱い、明示指示なしに別の商品へ替えない。
      - キャラクター商品の点数を増やすことを目的にしない。大きな布ものをすべて柄物にせず、通常家具とのバランスと、残す家具・音楽や作業・グッズを飾る場所・通路を確かめる。
      - title と concept は要望に合わせて日本語で書く。concept には商品名を書かない。
      - 要望で今ある家具を「いらない」「外したい」「捨てる」「別のに替えたい」とはっきり書いているときだけ、
        その家具の id を remove_object_ids に入れる。「そのまま使いたい」と書かれた家具や、触れられていない家具は入れない。
      %<previous>s
    TEXT

    PREVIOUS = <<~TEXT.freeze
      # 前回の提案 (追加の指示で作り直す)
      前回の要望: %<prompt>s
      前回のタイトル: %<title>s
      前回の商品 (id | group_id | 枠 | 商品名):
      %<items>s

      上の要望に書かれた今回の指示と、現在のテーマ・配色を優先する。末尾のテーマ・配色の補足だけを追加指示とみなさない。
      - 追加の指示に関係しないグループは、候補にある前回の商品をすべてselected_item_idsに指定し、item_idsの先頭にも入れて残す。
      - 追加の指示に関係するグループだけを選び直す。group_id・slot・idは今回の商品候補の組を使う。
      - 前回の商品が候補に無い、配置できない場合は無理に残さず、変更理由をunavailable_noteに書く。
      - title と concept は、前回からの変化が分かるように書く。
    TEXT

    def initialize(prompt:, room:, kept_objects:, user_id: nil, client: nil, additional_candidates: [], previous: nil, slots: SLOT_PRIORITY, preference: nil, character_theme: nil)
      @slots = slots
      @preference = preference
      @character_theme = character_theme
      @prompt = prompt
      @room = room
      @kept_objects = kept_objects
      @previous = previous
      @user_id = user_id
      @client = client || FurnitureCandidates.client(user_id: user_id)
      @additional_candidates = additional_candidates
    end

    def plan
      color_preference = FurnitureCandidates::ColorPreference.new(@prompt)
      previous_ids = Array(@previous&.items).map { |item| item["item_id"] }
      items = (@client.search(prompt: @prompt, theme: nil, slots: @slots, preference: @preference, character_theme: @character_theme).values.flatten + @additional_candidates)
        .uniq { |item| [ group_id(item), item.id ] }.group_by { |item| group_id(item) }.values.flat_map do |group|
          group = color_preference.focused_candidates(group)
          if @character_theme
            FurnitureCandidates.shortlist(group, CANDIDATES_PER_GROUP, preference: @preference, character_theme: @character_theme, preferred_ids: previous_ids)
          else
            FurnitureCandidates.spread(group, CANDIDATES_PER_GROUP)
          end
        end
      response = GeminiClient.new.generate_json(prompt: prompt_for(items), schema: SCHEMA)
      json = response.json.is_a?(Hash) ? response.json : {}
      ranked, selection = candidates(json["picks"], items)
      Plan.new(
        title: json["title"].to_s.strip.presence&.truncate(30) || "あなたのコーデ",
        concept: json["concept"].to_s.strip.presence&.truncate(120),
        note: json["unavailable_note"].to_s.strip.presence&.truncate(120),
        candidates: ranked,
        removed_object_ids: Array(json["remove_object_ids"]).map(&:to_s) & @kept_objects.pluck("id"),
        planned_by: "gemini",
        analysis: {
          "response" => json,
          "selection" => selection,
          "meta" => { "planner" => "gemini", "model" => response.model, "thinking_level" => response.thinking_level,
                      "elapsed_s" => response.elapsed, "usage" => response.usage, "candidate_count" => items.size }
        }
      )
    end

    private

    def prompt_for(items)
      format(
        PROMPT,
        prompt: @prompt,
        wall_color: color_text(@room["wall_color"]),
        floor_color: color_text(@room["floor_color"]),
        max_picks: MAX_PICKS.map { |slot, count| "#{slot}は#{count}点" }.join("・"),
        room_size: @room.slice("width", "depth", "height").to_json,
        kept: @kept_objects.map { |o| o.slice("id", "label", "category", "color", "size", "position").merge("color_word" => FurnitureCandidates::Colors.word(o["color"])).compact }.to_json,
        previous: previous_section,
        items: items.map { |item| candidate_json(item) }.to_json
      )
    end

    def previous_section
      return "" unless @previous

      format(
        PREVIOUS,
        prompt: @previous.prompt,
        title: @previous.title,
        items: @previous.items.map { |item| "#{item['item_id']} | #{item['group_id'] || item['slot']} | #{item['slot']} | #{item['name']}" }.join("\n")
      )
    end

    def group_id(item)
      item.metadata["group_id"] || item.slot
    end

    def color_text(hex)
      word = FurnitureCandidates::Colors.word(hex)
      word ? "#{hex} (#{word})" : hex
    end

    def candidate_json(item)
      metadata = item.metadata
      { id: item.id, group_id: group_id(item), slot: item.slot, category: item.category, name: item.name,
        color: item.color, color_word: FurnitureCandidates::Colors.word(item.color), price: item.price, size: item.size, published_size: metadata["size"], estimated_axes: metadata["estimated_axes"],
        material: metadata["material"], shape: metadata["shape"], color_name: metadata["color_name"], characters: metadata["characters"], selected_by_user: metadata["selected_by_user"], themes: metadata["themes"]&.filter_map { |theme| FurnitureCandidates::THEMES[theme] },
        official_color: metadata["color_name"], requested_color_rank: FurnitureCandidates::ColorPreference.new(@prompt).rank(item),
        target_size: metadata["target_size"], preferred_position: metadata["preferred_position"] }.compact
    end

    # 床グループを潰さず、存在しないid・slot/group違い・不正型は捨てる。
    def candidates(picks, items)
      groups = items.group_by { |item| group_id(item) }
      ranked = {}
      selection = []
      return [ [], [] ] unless picks.is_a?(Array)

      picks.each do |pick|
        next unless pick.is_a?(Hash)

        slot = pick["slot"]
        group = pick["group_id"]
        next unless (SLOT_PRIORITY + [ "floor" ]).include?(slot) && groups.key?(group) && !ranked.key?(group)

        by_id = groups.fetch(group).select { |item| item.slot == slot }.index_by(&:id)
        next if by_id.empty?

        ids = pick["item_ids"].is_a?(Array) ? pick["item_ids"] : []
        # 枠の上限を超えた分は採用しない。床の家具は操作 (group) ごとに 1 点
        selected = Array(pick["selected_item_ids"]).filter_map { |id| by_id[id] if id.is_a?(Integer) }.uniq.first(group == slot ? MAX_PICKS.fetch(slot, 1) : 1)
        approved = ids.filter_map { |id| by_id[id] if id.is_a?(Integer) }.uniq.first(RANKED_PER_GROUP)
        ranked[group] = (selected + approved).uniq
        selected.each { |item| selection << { "group_id" => group, "item_id" => item.id } }
      end
      [ ranked.values.flatten, selection ]
    end
  end
end
