# コーデを組み立てる: 商品候補を選ぶ (CoordinationPlanner) → 枠に配置する (SlotLayout)。
# 置き場所が無い商品は採用しないので、購入リンク一覧と 3D の表示は常に一致する。
class CoordinationBuilder
  # kept_object_ids: 実際に活かした家具 (要望文で「いらない」と書かれた家具を除いたもの)
  Result = Data.define(:title, :comment, :after_scene, :items, :total_price, :planned_by, :analysis, :kept_object_ids, :furniture_operations)

  def self.call(coordination)
    new(coordination).call
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
      edit ? object.merge(edit.slice("position", "size", "rotation_y", "color")) : object
    end
  end

  def call
    kept = kept_objects
    client = FurnitureCandidates.client(selected: selected_product_items)
    gemini = GeminiClient.configured?(user_id: @coordination.room.user_id)
    candidate_limit = gemini ? CoordinationPlanner::Gemini::CANDIDATES_PER_GROUP : 3
    # 要望文から読み取った色・雰囲気・形。合う商品を先に候補へ入れる (モックは並び順のまま)
    preference = FurnitureQuery.call(@coordination.generation_prompt, user_id: @coordination.room.user_id) if gemini
    floor_candidates = FurnitureOperationPlanner.call(@coordination, @scene, client:, candidate_limit:, preference:)
    plan = CoordinationPlanner.call(prompt: @coordination.generation_prompt, room: @scene["room"], kept_objects: kept, user_id: @coordination.room.user_id, client:, additional_candidates: floor_candidates, previous:, preference:,
                                    slots: SlotLayout.placeable_slots(@scene["room"], kept))
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
    failures << "条件と配置に合う家具が登録されていませんでした。希望を変更して再提案してください。" if placed.empty?

    Result.new(
      title: result_title(plan),
      comment: [ @coordination.character_theme_id ? "#{CharacterRoomTheme.find(@coordination.character_theme_id).fetch('name')}をイメージしたインテリアです。" : nil, comment(plan, placed, active, removed), *failures ].compact.join,
      after_scene: appearance.fetch(:scene),
      items: appearance.fetch(:items),
      total_price: placed.sum { |p| p[:item].price },
      planned_by: plan.planned_by,
      # 精度の確認用: Gemini の回答と、実際に採用した商品
      analysis: (@coordination.analysis || {}).deep_merge(plan.analysis).deep_merge("placed_item_ids" => placed.map { |p| p[:item].id }, "base_coordination_id" => @coordination.base_coordination_id, "preference" => preference&.to_h&.stringify_keys, "meta" => { "product_source" => "db" }, "operation_failures" => failures),
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
      placement_options(item, by_group[group]).each do |candidate|
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
      product ? edit.merge("id" => SlotLayout.object_id_for(product)) : edit
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
      "product_metadata" => item.metadata.except("preferred_position", "preferred_rotation", "target_size")
    }
  end
end
