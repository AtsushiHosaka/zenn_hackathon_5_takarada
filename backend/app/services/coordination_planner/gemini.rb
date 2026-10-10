class CoordinationPlanner
  # 操作ごとの候補を保持して、予算内で色・素材・用途が合う一式と代替順位を選ぶ。
  # id/group/slotと合計金額、置き場所はRubyで再確認する。
  class Gemini
    CANDIDATES_PER_GROUP = 12
    RANKED_PER_GROUP = 6
    SCHEMA = {
      type: "object",
      properties: {
        title: { type: "string", description: "コーデの名前 (20 文字以内。例: 深紅の推し活ルーム)" },
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
              selected_item_id: { type: "integer", description: "この一式で購入する商品id。採用しないグループは0" },
              item_ids: { type: "array", items: { type: "integer" }, description: "この一式と相性がよい配置用の代替候補をおすすめ順に最大6件" }
            },
            required: %w[group_id slot selected_item_id item_ids]
          }
        }
      },
      required: %w[title concept unavailable_note remove_object_ids picks]
    }.freeze

    SLOT_LABELS = {
      "bed_cover" => "ベッドカバー", "curtain" => "カーテン", "rug" => "ラグ", "wall_decor" => "壁飾り",
      "light" => "照明", "display" => "飾り棚・大きめの飾り", "cushion" => "クッション", "desk_top" => "デスクの上の小物", "floor" => "追加・入れ替え用の大型家具"
    }.freeze

    PROMPT = <<~TEXT.freeze
      あなたはインテリアコーディネーターです。複数の商品候補から、要望・テンプレートの雰囲気と予算に合う一式を選びます。
      残す家具は維持します。寸法と用途も確認しますが、最終的な配置と合計価格は別の処理で判定します。

      # 要望
      %<prompt>s

      # 部屋
      - 壁の色: %<wall_color>s / 床の色: %<floor_color>s
      - 寸法 (m): %<room_size>s
      - 今ある家具 (id・名前・寸法・配置): %<kept>s
      - 商品価格の合計予算: %<budget>s 円 (送料と追加部品は別)

      # 商品候補 (JSON。寸法はm)
      sizeは配置する寸法、published_sizeは公開寸法 (nullは不明)、estimated_axesは描画用の推定軸です。推定値を公式寸法として説明しないでください。
      %<items>s

      # 選び方
      - 各group_idで最大1商品をselected_item_idに指定し、採用する商品の合計を必ず予算以下にする。全グループの最安商品を埋めることを目的にしない。
      - 要望・テンプレートの色調、素材、形、用途と、壁・床・残す家具との相性を一式として評価する。高価な1点への偏りを避け、用途の重要度と相性に応じて予算を配分する。
      - replace:<家具ID>とadd:<番号>はユーザーが指定した床家具の用途。これらを優先し、同じSKUでも別group_idなら別の購入点数として価格を加算する。
      - 床家具の候補はcategoryとgroup_idを必ず一致させる。交換はtarget_size/元の位置を参照し、部屋に対して大きすぎる候補は避ける。
      - 各グループのitem_idsは、この一式と素材・色・用途が合う代替候補をおすすめ順に最大6件指定する。合わない商品を価格だけで候補へ加えない。
      - 候補にあるgroup_id/slot/idの組だけを使う。採用しないグループはselected_item_idを0にするかpicksから省く。無理に埋めない。
      - picksは指定された床家具を先に、その後はこの提案で重要なグループの順に並べる。
      - 要望の色や雰囲気そのものの商品が無いときは、近い色・雰囲気の商品を選び、unavailable_note で
        「赤い商品が見つからなかったため、近い色の○○を選びました」のように正直に伝える。あれば空文字にする。
      - 今ある家具の色と、壁・床の色とも合うようにする。
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

      要望の最後の行が、今回の追加の指示。
      - 追加の指示に関係しないグループは、候補にある前回の商品をselected_item_idに指定し、item_idsの先頭にも入れて残す。
      - 追加の指示に関係するグループだけを選び直す。group_id・slot・idは今回の商品候補の組を使う。
      - 前回の商品が候補に無い、予算が減った、配置できない場合は無理に残さず、変更理由をunavailable_noteに書く。
      - title と concept は、前回からの変化が分かるように書く。
    TEXT

    def initialize(prompt:, budget:, room:, kept_objects:, user_id: nil, client: nil, additional_candidates: [], previous: nil, slots: SLOT_PRIORITY)
      @slots = slots
      @prompt = prompt
      @budget = budget
      @room = room
      @kept_objects = kept_objects
      @previous = previous
      @user_id = user_id
      @client = client || FurnitureCandidates.client(user_id: user_id)
      @additional_candidates = additional_candidates
    end

    def plan
      items = (@client.search(prompt: @prompt, theme: nil, slots: @slots, max_price: @budget).values.flatten + @additional_candidates)
        .uniq { |item| [ group_id(item), item.id ] }.group_by { |item| group_id(item) }.values.flat_map { |group| group.first(CANDIDATES_PER_GROUP) }
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
        wall_color: @room["wall_color"],
        floor_color: @room["floor_color"],
        room_size: @room.slice("width", "depth", "height").to_json,
        kept: @kept_objects.map { |o| o.slice("id", "label", "category", "color", "size", "position") }.to_json,
        previous: previous_section,
        budget: @budget.to_fs(:delimited),
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

    def candidate_json(item)
      metadata = item.metadata
      { id: item.id, group_id: group_id(item), slot: item.slot, category: item.category, name: item.name,
        color: item.color, price: item.price, size: item.size, published_size: metadata["size"], estimated_axes: metadata["estimated_axes"],
        material: metadata["material"], shape: metadata["shape"], color_name: metadata["color_name"],
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
        selected_id = pick["selected_item_id"]
        selected = by_id[selected_id] if selected_id.is_a?(Integer) && selected_id.positive?
        approved = ids.filter_map { |id| by_id[id] if id.is_a?(Integer) }.uniq.first(RANKED_PER_GROUP)
        ranked[group] = selected ? [ selected, *approved.reject { |item| item.id == selected.id } ] : approved
        if selected
          selection << { "group_id" => group, "item_id" => selected.id }
        end
      end
      [ ranked.values.flatten, selection ]
    end
  end
end
