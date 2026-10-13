# コーデを組み立てる: 商品候補を選ぶ (CoordinationPlanner) → 枠に配置する (SlotLayout)。
# 置き場所が無い商品は採用しないので、購入リンク一覧と 3D の表示は常に一致する。
class CoordinationBuilder
  # kept_object_ids: 実際に活かした家具 (要望文で「いらない」と書かれた家具を除いたもの)
  Result = Data.define(:title, :comment, :after_scene, :items, :total_price, :planned_by, :analysis, :kept_object_ids, :furniture_operations)

  def self.call(coordination)
    # 追加の指示は、前回の完成状態に変える部分だけを当てる。全体の作り直しを求められたときは下の通常の流れに戻る
    return FollowupCoordinationBuilder.new(coordination).call if FollowupCoordinationBuilder.applies?(coordination)

    new(coordination).call
  end

  def self.item_json(item, note, marker)
    {
      "marker" => marker,
      "item_id" => item.id,
      "slot" => item.slot,
      "category" => item.category,
      "name" => item.name,
      "price" => item.price,
      "shop" => item.shop,
      "url" => item.url,
      "image_url" => item.image_url,
      "color" => item.color,
      "placement_note" => note,
      "product_metadata" => item.metadata.except("preferred_position", "preferred_rotation", "target_size", "selected_by_user")
    }
  end

  def initialize(coordination)
    @coordination = coordination
    @scene = coordination.input_scene
    if (palette = RoomPalette.find(coordination.room_palette_id))
      @scene["room"].merge!("wall_color" => palette.fetch("base"), "floor_color" => palette.fetch("secondary"))
    elsif (theme = CharacterRoomTheme.find(coordination.character_theme_id))
      @scene["room"].merge!("wall_color" => theme.fetch("base"), "floor_color" => theme.fetch("secondary"))
    end
    @scene["objects"].map! do |object|
      edit = coordination.edited_objects.find { |value| value["id"] == object["id"] }
      edit ? object.merge(edit.slice("position", "size", "rotation_y", "color", "attach_to")) : object
    end
  end

  def call
    kept = kept_objects
    client = FurnitureCandidates.client(selected: selected_product_items, characters: wanted_characters)
    @candidate_client = client
    gemini = GeminiClient.configured?(user_id: @coordination.room.user_id)
    candidate_limit = gemini ? CoordinationPlanner::Gemini::CANDIDATES_PER_GROUP : 3
    character_theme = CharacterRoomTheme.suggestion_profile(@coordination.character_theme_id, palette_id: @coordination.room_palette_id)
    # Read literal user preferences separately from appended theme/palette instructions.
    # Otherwise a generated theme default can masquerade as an explicit user color.
    preference_text = character_theme ? @coordination.prompt : @coordination.generation_prompt
    preference = FurnitureQuery.call(preference_text, user_id: @coordination.room.user_id) if gemini || character_theme
    if character_theme
      literal_color = (FurnitureCandidates::Colors::THEME_PATTERNS.to_a + FurnitureCandidates::Colors::PATTERNS.to_a)
        .find { |_, pattern| pattern.match?(@coordination.prompt) }&.first
      preference = preference.with(color: RoomPalette.find(@coordination.room_palette_id) ? nil : literal_color)
    end
    floor_candidates = FurnitureOperationPlanner.call(@coordination, @scene, client:, candidate_limit:, preference:, character_theme:)
    suggested_floor = gemini ? suggested_floor_candidates(client, preference, candidate_limit, character_theme:) : []
    plan = CoordinationPlanner.call(prompt: @coordination.generation_prompt, room: @scene["room"], kept_objects: kept, user_id: @coordination.room.user_id, client:, additional_candidates: floor_candidates + suggested_floor, previous:, preference:,
                                    slots: SlotLayout.placeable_slots(@scene["room"], kept), character_theme:)
    removed, kept = kept.partition { |object| plan.removed_object_ids.include?(object["id"]) }
    # 従来の空配列は「全部活かす」。明示操作がある場合は、全置換・全除外も許可する。
    removed, kept = [], kept_objects if kept.empty? && @coordination.furniture_operations.empty?
    explicit_remove_ids = @coordination.furniture_operations.select { |operation| operation["action"] == "remove" }.pluck("object_id")
    removed += @scene["objects"].select { |object| explicit_remove_ids.include?(object["id"]) }
    coherent = plan.planned_by == "gemini"
    candidates = coherent ? plan.candidates : floor_candidates + plan.candidates.reject { |item| item.slot == "floor" }
    by_group = candidates.group_by { |item| item.metadata["group_id"] || item.slot }
    # [グループ, 商品] の並び。Gemini は 1 つの枠に複数の商品を選べる (CoordinationPlanner::MAX_PICKS)
    chosen = coherent ? choose_planned_bundle(plan, by_group) : by_group.transform_values(&:first).to_a
    floor_choices = chosen.select { |_, item| item.slot == "floor" }
    active, floor_placed = place_floor_choices(floor_choices, by_group, kept, removed_object_ids: removed.pluck("id"))
    anchors = active + floor_placed.map { |entry| entry[:placement].object }
    by_slot = by_group.reject { |_, items| items.first.slot == "floor" }
    chosen = chosen.reject { |_, item| item.slot == "floor" }
    placed = []
    loop do
      reserved_ids = chosen.map { |_, item| SlotLayout.object_id_for(item) }
      placed = place_choices(chosen, by_slot, anchors)
      newly_kept_edit = placed.any? do |entry|
        id = SlotLayout.object_id_for(entry[:item])
        @coordination.edited_objects.any? { |edit| edit["id"] == id } && !reserved_ids.include?(id)
      end
      break unless newly_kept_edit

      chosen = placed.map { |entry| [ entry[:slot], entry[:item] ] }
    end
    placed = floor_placed + placed

    placed.each.with_index(1) do |entry, marker|
      entry[:placement].object["marker"] = marker
      entry[:placement].object["furniture_detail_id"] = entry[:item].metadata["furniture_detail_id"] if entry[:item].metadata["furniture_detail_id"]
    end
    scene = { "room" => @scene["room"], "objects" => active + placed.map { |entry| entry[:placement].object } }
    items = placed.map.with_index(1) { |entry, marker| item_json(entry[:item], entry[:placement].note, marker) }
    appearance = FurnitureProductAppearance.call(scene:, items:)
    failures = operation_failures(floor_placed)
    if character_theme && client.unavailable_color_slots.any?
      labels = client.unavailable_color_slots.map { |slot| CoordinationPlanner::Gemini::SLOT_LABELS.fetch(slot) }
      failures << "#{labels.join('・')}には、希望の販売色を確認できた商品がありませんでした。"
    end
    if placed.empty?
      failures << (character_theme ? "お店で販売されている色を確認できた商品に、希望の配色と配置に合う家具がありませんでした。" : "条件と配置に合う家具が登録されていませんでした。希望を変更して再提案してください。")
    end
    if character_theme && placed.any?
      colors = preference&.color ? [ preference.color ] : character_theme.fetch("colors")
      unless placed.any? { |entry| colors.any? { |color| FurnitureCandidates::Colors.matches?("#{entry[:item].metadata['color_name']} #{entry[:item].name}", color) } }
        names = { "cyan" => "シアン", "blue" => "ブルー", "white" => "白", "gray" => "グレー", "black" => "黒", "beige" => "ベージュ", "brown" => "ブラウン", "green" => "グリーン", "purple" => "紫", "pink" => "ピンク", "red" => "赤", "orange" => "オレンジ", "yellow" => "黄色" }
        failures << "希望の#{colors.map { |color| names.fetch(color) }.join('・')}の商品は今回の提案に含まれていません。商品の登録色を使って提案しています。"
      end
    end

    Result.new(
      title: result_title(plan),
      comment: [ @coordination.character_theme_id ? "#{CharacterRoomTheme.find(@coordination.character_theme_id).fetch('name')}をイメージしたインテリアです。" : nil, comment(plan, placed, active, removed), *failures ].compact.join,
      after_scene: appearance.fetch(:scene),
      items: appearance.fetch(:items),
      total_price: placed.sum { |p| p[:item].price },
      planned_by: plan.planned_by,
      # 精度の確認用: Gemini の回答と、実際に採用した商品
      analysis: (@coordination.analysis || {}).deep_merge(plan.analysis).deep_merge("placed_item_ids" => placed.map { |p| p[:item].id }, "base_coordination_id" => @coordination.base_coordination_id, "preference" => preference&.to_h&.stringify_keys, "character_suggestion_profile" => character_theme, "meta" => { "product_source" => "db" }, "operation_failures" => failures),
      kept_object_ids: active.pluck("id"),
      furniture_operations: result_operations(active, removed)
    )
  end

  private

  def result_title(plan)
    if (theme = CharacterRoomTheme.find(@coordination.character_theme_id))
      theme.fetch("title")
    elsif plan.planned_by == "mock" && (palette = RoomPalette.find(@coordination.room_palette_id))
      "#{palette.fetch('name')}の部屋"
    else
      plan.title
    end
  end

  def result_operations(active, removed)
    if @coordination.furniture_operations.empty?
      active_ids = active.pluck("id")
      return @scene["objects"].map do |object|
        { "object_id" => object["id"], "action" => active_ids.include?(object["id"]) ? "keep" : "remove" }
      end
    end

    removed_ids = removed.pluck("id")
    @coordination.furniture_operations.map do |operation|
      removed_ids.include?(operation["object_id"]) ? operation.merge("action" => "remove") : operation
    end
  end

  def place_floor_choices(chosen, by_group, kept, removed_object_ids: [])
    active = @coordination.furniture_operations.empty? ? kept.dup : @scene.fetch("objects").reject { |object| removed_object_ids.include?(object["id"]) }
    placed = []
    chosen.each do |group, item|
      original_id = item.metadata["replaces_object_id"]
      occupants = active.reject { |object| object["id"] == original_id } + placed.map { |entry| entry[:placement].object }
      # 置けないときの代わりは同じ種類の候補だけ。ほかに選ばれた商品・先に置いた商品は代わりにしない
      alternatives = by_group[group].select { |candidate| candidate.category == item.category && chosen.exclude?([ group, candidate ]) }
      placement_options(item, alternatives).each do |candidate|
        next if placed.any? { |entry| entry[:slot] == group && entry[:item] == candidate }

        layout = SlotLayout.new(@scene, occupants, edited_objects: layout_edits)
        placement = layout.place(candidate) or next
        placement.object["replaces_object_id"] = original_id
        placed << { slot: group, item: candidate, placement: }
        active.reject! { |object| object["id"] == original_id } if original_id
        break
      end
    end
    [ active, placed ]
  end

  # 要望文かキャラクターテーマに出てくるキャラクター。そのグッズだけを候補にし、関係のない提案にキャラクターのグッズを混ぜない
  def wanted_characters
    query = CharacterQuery.call(@coordination.generation_prompt, llm: false)
    themed = @coordination.character_theme_id ? Character.where(theme_id: @coordination.character_theme_id).pluck(:character_key) : []
    query.characters + Character.joins(:franchise).where(franchises: { franchise_key: query.franchises }).pluck(:character_key) + themed
  end

  # AI が自分から足せる大型家具の候補。部屋にある種類と、利用者が追加を指定した種類は出さない。
  # 種類ごとに形の違うものを順に取る (並び順のままだと、先に並ぶ椅子だけで埋まりソファや収納が候補に入らない)
  def suggested_floor_candidates(client, preference, limit, character_theme: nil)
    categories = FurnitureCandidates::FLOOR_CATEGORIES - @scene["objects"].pluck("category") - @coordination.additions.pluck("category")
    return [] if categories.empty?

    items = client.search(slots: [ "floor" ], categories:, preference:, character_theme:).fetch("floor", []).reject { |item| item.metadata["group_id"] }
    per_category = items.group_by(&:category).values.flat_map do |group|
      character_theme ? FurnitureCandidates.shortlist(group, limit, preference:, character_theme:) : FurnitureCandidates.spread(group, limit)
    end
    FurnitureCandidates.spread(per_category, limit, &:category)
  end

  def operation_failures(placed)
    done = placed.map { |entry| entry[:item].metadata["group_id"] }
    replacements = @coordination.furniture_operations.select { |operation| operation["action"] == "replace" }.filter_map do |operation|
      next if done.include?("replace:#{operation['object_id']}")

      original = @scene["objects"].find { |object| object["id"] == operation["object_id"] }
      "#{original['label']}は#{unavailable_reason(original['category'])}ため、そのまま残しました。"
    end
    additions = @coordination.additions.each_with_index.filter_map do |addition, index|
      "追加する#{ { 'sofa' => 'ソファ', 'bed' => 'ベッド', 'desk' => 'デスク', 'chair' => '椅子', 'shelf' => '収納棚', 'table' => 'テーブル' }.fetch(addition['category']) }は#{unavailable_reason(addition['category'])}ため、追加しませんでした。" unless done.include?("add:#{index}")
    end
    replacements + additions
  end

  def unavailable_reason(category)
    FurnitureDetail.exists?(category:) ? "配置できる商品が見つからなかった" : "この種類の家具がまだ登録されていない"
  end

  def place_choices(chosen, by_slot, kept)
    candidates = by_slot.values.flatten.index_by { |item| SlotLayout.object_id_for(item) }
    edits = layout_edits.filter_map do |edit|
      item = candidates[edit["id"]]
      edit.merge("slot" => item.slot) if item
    end
    layout = SlotLayout.new(@scene, kept, edited_objects: edits, reserved_object_ids: chosen.map { |_, item| SlotLayout.object_id_for(item) })
    used = []
    chosen.filter_map do |slot, item|
      # 置けなければ、同じグループの候補 (Gemini では承認済みの代替) を順に試す。同じ枠でほかに選ばれた商品・先に置いた商品は代替にしない
      alternatives = by_slot[slot].reject { |candidate| chosen.include?([ slot, candidate ]) }
      placement_options(item, alternatives).each do |candidate|
        next if used.include?(candidate)

        placement = layout.place(candidate) or next
        used << candidate
        break({ slot:, item: candidate, placement: })
      end.then { |entry| entry.is_a?(Hash) ? entry : nil }
    end
  end

  def placement_options(item, candidates)
    [ item, *candidates.reject { |candidate| candidate == item } ]
  end

  # Geminiの総合提案を尊重する。未採用グループを勝手に埋めない。指定された床家具を先に置く
  def choose_planned_bundle(plan, by_group)
    selections = plan.analysis["selection"]
    return [] unless selections.is_a?(Array)

    selections.select { |selection| selection.is_a?(Hash) }
      .sort_by { |selection| Array(by_group[selection["group_id"]]).first&.slot == "floor" ? 0 : 1 }
      .each_with_object([]) do |selection, chosen|
        group = selection["group_id"]
        item = Array(by_group[group]).find { |candidate| candidate.id == selection["item_id"] }
        chosen << [ group, item ] if item && chosen.exclude?([ group, item ])
      end
  end

  def selected_product_items
    @selected_product_items ||= begin
      @selected_products_by_edit = {}
      base = @coordination.base_coordination
      originals = Array(base&.after_scene&.fetch("objects", [])) + @coordination.input_scene.fetch("objects")
      @coordination.edited_objects.filter_map do |edit|
        original = originals.find { |object| object["id"] == edit["id"] }
        product = FurnitureCandidates::Client.find_item(edit["replacement_furniture_detail_id"] || edit["furniture_detail_id"])
        next unless original && product
        next if original["id"].match?(Coordination::MANUAL_OBJECT_ID) && edit["replacement_furniture_detail_id"].nil?

        next if original["source"] == "existing" && @coordination.furniture_operations.any? { |operation| operation["object_id"] == original["id"] && operation["action"] != "replace" }

        previous = Array(base&.items).find { |item| item["item_id"] == original["item_id"] && (original["marker"].nil? || item["marker"] == original["marker"]) }
        metadata = product.metadata.merge(previous&.fetch("product_metadata", {})&.slice("group_id", "replaces_object_id") || {})
        if original["source"] == "existing"
          metadata = metadata.merge("group_id" => "replace:#{original['id']}", "replaces_object_id" => original["id"], "preferred_position" => edit["position"], "preferred_rotation" => edit["rotation_y"], "target_size" => original["size"])
        end
        item = product.with(slot: original["slot"] || "floor", metadata:)
        @selected_products_by_edit[edit["id"]] = item
        item
      end
    end
  end

  def layout_edits
    selected_product_items
    @coordination.edited_objects.map do |edit|
      product = @selected_products_by_edit[edit["id"]]
      product = @candidate_client.resolved_selection(product) if product && @candidate_client
      product ? edit.merge("id" => SlotLayout.object_id_for(product), **(@coordination.character_theme_id ? { "color" => product.color } : {})) : edit
    end
  end

  def effective_previous_items
    base = @coordination.base_coordination
    previous_items = Array(base&.items).map do |item|
      original = Array(base.after_scene&.fetch("objects", [])).find { |object| object["item_id"] == item["item_id"] && (item["marker"].nil? || object["marker"] == item["marker"]) }
      edit = original && @coordination.edited_objects.find { |value| value["id"] == original["id"] }
      product = edit && FurnitureCandidates::Client.find_item(edit["furniture_detail_id"])
      product ? item.merge(product.to_h.stringify_keys.except("id", "slot", "metadata")).merge("item_id" => product.id, "product_metadata" => product.metadata.merge(item.fetch("product_metadata", {}).slice("group_id", "replaces_object_id"))) : item
    end
    previous_items + selected_product_items.reject { |selected| previous_items.any? { |item| item["item_id"] == selected.id && item.dig("product_metadata", "group_id") == selected.metadata["group_id"] } }.map do |item|
      item.to_h.stringify_keys.except("id", "metadata").merge("item_id" => item.id, "product_metadata" => item.metadata)
    end
  end

  # 追加の指示のときの前回のコーデ。前回の商品を引き継ぐのに使う
  def previous
    base = @coordination.base_coordination
    return if !base && selected_product_items.empty?
    return if base && base.status != "done"
    # A new theme/palette is a room-wide change; old automatic picks must not
    # crowd out the new colors. Explicit selections remain in the candidate client.
    if base && (@coordination.character_theme_id == "hatsune-miku" || base.character_theme_id == "hatsune-miku")
      return if base.character_theme_id != @coordination.character_theme_id || base.room_palette_id != @coordination.room_palette_id
    end

    CoordinationPlanner::Previous.new(prompt: base&.prompt || @coordination.prompt, title: base&.title || "選択した家具", items: effective_previous_items.map { |item| item.slice("item_id", "slot", "name").merge("group_id" => item.dig("product_metadata", "group_id") || item["slot"]) })
  end

  # kept_object_ids が空なら今ある家具をすべて活かす
  def kept_objects
    objects = @scene["objects"]
    ids = @coordination.kept_object_ids
    unless @coordination.furniture_operations.empty?
      ids = @coordination.furniture_operations.select { |operation| operation["action"] == "keep" }.pluck("object_id")
      return objects.select { |object| ids.include?(object["id"]) }
    end
    ids.blank? ? objects : objects.select { |o| ids.include?(o["id"]) }
  end

  # コンセプト (Gemini) + 実際に置いた商品 + 活かした家具 + 断り書き (Gemini)。
  # 商品の部分は置いた結果から組み立てるので、置き場所で外れた商品には触れない
  def comment(plan, placed, kept, removed)
    added = placed.first(3).map { |p| "#{p[:item].name} (#{p[:placement].note})" }.join("、")
    kept_labels = kept.map { |o| o["label"] }.join("と")
    parts = [ plan.concept ]
    parts << "#{added} などを追加しました。" if added.present?
    parts << "今の#{kept_labels}はそのまま活かしています。" if kept_labels.present?
    parts << "ご要望に合わせて、#{removed.map { |o| o['label'] }.join('と')}は外しました。" if removed.any?
    parts << plan.note
    parts.compact.join
  end

  def item_json(item, note, marker)
    self.class.item_json(item, note, marker)
  end
end
