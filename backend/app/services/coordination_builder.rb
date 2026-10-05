# コーデを組み立てる: 商品候補を選ぶ (CoordinationPlanner) → 枠に配置する (SlotLayout) → 予算内に収める。
# 置き場所が無い商品・予算を超える商品は採用しないので、購入リンク一覧と 3D の表示は常に一致する。
class CoordinationBuilder
  Result = Data.define(:title, :comment, :after_scene, :items, :total_price, :planned_by, :analysis)

  def self.call(coordination)
    new(coordination).call
  end

  def initialize(coordination)
    @coordination = coordination
    @scene = coordination.room.scene.deep_dup
    @scene["objects"].map! do |object|
      edit = coordination.edited_objects.find { |value| value["id"] == object["id"] }
      edit ? object.merge(edit.except("id")) : object
    end
  end

  def call
    kept = kept_objects
    replacement_ids = @coordination.furniture_operations.select { |operation| operation["action"] == "replace" }.pluck("object_id")
    preferred_categories = (@scene["objects"].select { |object| replacement_ids.include?(object["id"]) }.pluck("category") + @coordination.additions.pluck("category")).uniq
    client = InteriorLinks.client(user_id: @coordination.room.user_id, preferred_categories:)
    floor_candidates = FurnitureOperationPlanner.call(@coordination, @scene, client:)
    plan = CoordinationPlanner.call(prompt: @coordination.prompt, budget: @coordination.budget, room: @scene["room"], kept_objects: kept, user_id: @coordination.room.user_id, client:, additional_candidates: floor_candidates)
    floor_rank = plan.candidates.select { |item| item.slot == "floor" }.map(&:id)
    floor_candidates.sort_by! { |item| floor_rank.index(item.id) || floor_rank.length }
    candidates = floor_candidates + plan.candidates.reject { |item| item.slot == "floor" }
    by_group = candidates.group_by { |item| item.metadata["group_id"] || item.slot }
    chosen = choose_within_budget(by_group)
    floor_choices = chosen.select { |_, item| item.slot == "floor" }
    active, floor_placed = place_floor_choices(floor_choices, by_group, kept)
    anchors = active + floor_placed.map { |entry| entry[:placement].object }
    by_slot = by_group.reject { |_, items| items.first.slot == "floor" }
    chosen = chosen.reject { |_, item| item.slot == "floor" }
    placed = []
    loop do
      reserved_ids = chosen.values.map { |item| SlotLayout.object_id_for(item) }
      placed = place_choices(chosen, by_slot, anchors)
      newly_kept_edit = placed.any? do |entry|
        id = SlotLayout.object_id_for(entry[:item])
        @coordination.edited_objects.any? { |edit| edit["id"] == id } && !reserved_ids.include?(id)
      end
      break unless newly_kept_edit

      chosen = placed.to_h { |entry| [ entry[:slot], entry[:item] ] }
    end
    placed = floor_placed + placed
    placed.each.with_index(1) { |entry, marker| entry[:placement].object["marker"] = marker }
    scene = { "room" => @scene["room"], "objects" => active + placed.map { |entry| entry[:placement].object } }
    items = placed.map.with_index(1) { |entry, marker| item_json(entry[:item], entry[:placement].note, marker) }
    appearance = FurnitureProductAppearance.call(scene:, items:, user_id: @coordination.room.user_id)
    product_source = InteriorLinks.provider(user_id: @coordination.room.user_id) == "live" ? "ec" : "mock"
    failures = operation_failures(floor_placed)
    if product_source == "ec" && placed.empty?
      failures << "条件と配置に合う実商品を確認できませんでした。希望や予算を変更して再提案してください。"
    end
    diagnostics = client.respond_to?(:diagnostics) ? client.diagnostics.except("search_entry_point") : {}

    Result.new(
      title: plan.title,
      comment: [ comment(plan, placed, active), *failures ].join,
      after_scene: appearance.fetch(:scene),
      items: appearance.fetch(:items),
      total_price: placed.sum { |p| p[:item].price },
      planned_by: plan.planned_by,
      # 精度の確認用: Gemini の回答と、実際に採用した商品
      analysis: plan.analysis.deep_merge("placed_item_ids" => placed.map { |p| p[:item].id }, "meta" => { "product_source" => product_source }, "operation_failures" => failures, "ec_search" => diagnostics, "search_entry_points" => client.respond_to?(:search_entry_points) ? client.search_entry_points : [])
    )
  end

  private

  def place_floor_choices(chosen, by_group, kept)
    active = @coordination.furniture_operations.empty? ? kept.dup : @scene.fetch("objects").dup
    placed = []
    chosen.each do |group, item|
      original_id = item.metadata["replaces_object_id"]
      occupants = active.reject { |object| object["id"] == original_id } + placed.map { |entry| entry[:placement].object }
      options = [ item, *by_group[group].select { |candidate| candidate != item && candidate.price <= item.price } ]
      options.each do |candidate|
        layout = SlotLayout.new(@scene, occupants, edited_objects: @coordination.edited_objects)
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
      "#{original['label']}は予算内で配置できる商品が見つからなかったため、そのまま残しました。"
    end
    additions = @coordination.additions.each_with_index.filter_map do |addition, index|
      "追加する#{ { 'sofa' => 'ソファ', 'bed' => 'ベッド', 'desk' => 'デスク', 'chair' => '椅子', 'shelf' => '収納棚', 'table' => 'テーブル' }.fetch(addition['category']) }は予算内で配置できる商品が見つかりませんでした。" unless done.include?("add:#{index}")
    end
    replacements + additions
  end

  def place_choices(chosen, by_slot, kept)
    candidates = by_slot.values.flatten.index_by { |item| SlotLayout.object_id_for(item) }
    edits = @coordination.edited_objects.filter_map do |edit|
      item = candidates[edit["id"]]
      edit.merge("slot" => item.slot) if item
    end
    layout = SlotLayout.new(@scene, kept, edited_objects: edits, reserved_object_ids: chosen.values.map { |item| SlotLayout.object_id_for(item) })
    chosen.filter_map do |slot, item|
      # 置き場所が無ければ、同じ枠のより安い候補で試す (予算は超えない)
      options = [ item, *by_slot[slot].select { |candidate| candidate != item && candidate.price <= item.price } ]
      options.each do |candidate|
        placement = layout.place(candidate) or next
        break({ slot:, item: candidate, placement: })
      end.then { |entry| entry.is_a?(Hash) ? entry : nil }
    end
  end

  # 枠ごとに 1 商品を予算内で選ぶ。
  # まず優先度の高い枠から各枠の最安値を入れてできるだけ多くの枠を埋め、
  # 余った予算で優先度の高い枠から順に、よりおすすめの商品へ格上げする
  def choose_within_budget(by_slot)
    budget = @coordination.budget
    chosen = {}
    total = 0
    by_slot.each do |slot, items|
      cheapest = items.min_by(&:price)
      next if total + cheapest.price > budget

      chosen[slot] = cheapest
      total += cheapest.price
    end

    chosen.each_key do |slot|
      better = by_slot[slot].find { |item| total - chosen[slot].price + item.price <= budget }
      total += better.price - chosen[slot].price
      chosen[slot] = better
    end
    chosen
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
  # 商品の部分は置いた結果から組み立てるので、予算や置き場所で外れた商品には触れない
  def comment(plan, placed, kept)
    added = placed.first(3).map { |p| "#{p[:item].name} (#{p[:placement].note})" }.join("、")
    kept_labels = kept.map { |o| o["label"] }.join("と")
    parts = [ plan.concept ]
    parts << "#{added} などを追加しました。" if added.present?
    parts << "今の#{kept_labels}はそのまま活かしています。" if kept_labels.present?
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
      "product_metadata" => item.metadata.except("group_id", "preferred_position", "preferred_rotation")
    }
  end
end
