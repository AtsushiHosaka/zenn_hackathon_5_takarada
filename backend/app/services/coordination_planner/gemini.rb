class CoordinationPlanner
  # 要望文・部屋・商品候補を Gemini に渡し、枠ごとに要望に合う商品を順位付けさせる。
  # Gemini が返すのは商品の id とタイトル・コンセプトだけで、予算と置き場所は Ruby 側で決める。
  # 存在しない id や枠の違う商品は捨てる (Gemini の回答をそのまま信じない)。
  class Gemini
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
              slot: { type: "string", enum: InteriorLinks::SLOTS },
              item_ids: { type: "array", items: { type: "integer" }, description: "要望に合う順 (最大 3 つ)" }
            },
            required: %w[slot item_ids]
          }
        }
      },
      required: %w[title concept unavailable_note remove_object_ids picks]
    }.freeze

    SLOT_LABELS = {
      "bed_cover" => "ベッドカバー", "curtain" => "カーテン", "rug" => "ラグ", "wall_decor" => "壁飾り",
      "light" => "照明", "display" => "飾り棚・大きめの飾り", "cushion" => "クッション", "desk_top" => "デスクの上の小物"
    }.freeze

    PROMPT = <<~TEXT.freeze
      あなたはインテリアコーディネーターです。一人暮らしの部屋に、今ある家具を活かしたまま買い足す商品を選びます。

      # 要望
      %<prompt>s

      # 部屋
      - 壁の色: %<wall_color>s / 床の色: %<floor_color>s
      - 今ある家具 (id: 名前 (色)): %<kept>s
      - 予算: %<budget>s 円 (合計の調整はこちらで行うので、予算を超える組み合わせでも構わない)

      # 商品候補 (id | 置き場所の枠 | 商品名 | 色 | 価格)
      %<items>s

      # 選び方
      - 枠ごとに、要望 (色・雰囲気・用途) に合う商品を、合う順に最大 3 つ選ぶ。候補にある id だけを使う。
      - 要望の雰囲気に合わない枠は、picks に含めなくてよい。合わない商品を無理に選ばない。
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
      前回の商品 (id | 枠 | 商品名):
      %<items>s

      要望の最後の行が、今回の追加の指示。
      - 追加の指示に関係しない枠は、前回の商品を item_ids の先頭にして、そのまま残す。
      - 追加の指示に関係する枠 (例: 「もっと落ち着いた紫に」なら色の目立つ布もの、「照明を変えたい」なら照明) だけ選び直す。
      - title と concept は、前回からの変化が分かるように書く。
    TEXT

    def initialize(prompt:, budget:, room:, kept_objects:, previous: nil)
      @prompt = prompt
      @budget = budget
      @room = room
      @kept_objects = kept_objects
      @previous = previous
    end

    def plan
      items = InteriorLinks.client.search(prompt: @prompt, theme: nil, slots: SLOT_PRIORITY, max_price: @budget).values.flatten
      response = GeminiClient.new.generate_json(prompt: prompt_for(items), schema: SCHEMA)
      json = response.json
      Plan.new(
        title: json["title"].to_s.strip.presence&.truncate(30) || "あなたのコーデ",
        concept: json["concept"].to_s.strip.presence&.truncate(120),
        note: json["unavailable_note"].to_s.strip.presence&.truncate(120),
        candidates: candidates(json["picks"], items),
        # 今ある家具の id だけを受け付ける (Gemini の回答をそのまま信じない)
        removed_object_ids: Array(json["remove_object_ids"]).map(&:to_s) & @kept_objects.map { |object| object["id"] },
        planned_by: "gemini",
        analysis: {
          "response" => json,
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
        kept: @kept_objects.map { |o| "#{o['id']}: #{o['label']} (#{o['color']})" }.join("、").presence || "なし",
        previous: previous_section,
        budget: @budget.to_fs(:delimited),
        items: items.map { |i| "#{i.id} | #{SLOT_LABELS.fetch(i.slot, i.slot)} (#{i.slot}) | #{i.name} | #{i.color} | #{i.price}円" }.join("\n")
      )
    end

    def previous_section
      return "" unless @previous

      format(
        PREVIOUS,
        prompt: @previous.prompt,
        title: @previous.title,
        items: @previous.items.map { |item| "#{item['item_id']} | #{item['slot']} | #{item['name']}" }.join("\n")
      )
    end

    # Gemini の順位を、枠の優先順に並べた候補にする。候補に無い id・枠の違う商品・重複は捨てる
    def candidates(picks, items)
      by_id = items.index_by(&:id)
      ranked = Array(picks).each_with_object({}) do |pick, result|
        slot = pick["slot"]
        next unless SLOT_PRIORITY.include?(slot)

        result[slot] ||= []
        Array(pick["item_ids"]).each do |id|
          item = by_id[id.to_i]
          result[slot] << item if item && item.slot == slot && !result[slot].include?(item)
        end
      end
      SLOT_PRIORITY.flat_map { |slot| Array(ranked[slot]).first(3) }
    end
  end
end
