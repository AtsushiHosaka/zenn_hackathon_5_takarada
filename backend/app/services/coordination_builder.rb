# コーデを組み立てる: 商品候補を選ぶ (CoordinationPlanner) → 枠に配置する (SlotLayout) → 予算内に収める。
# 置き場所が無い商品・予算を超える商品は採用しないので、購入リンク一覧と 3D の表示は常に一致する。
class CoordinationBuilder
  # kept_object_ids: 実際に活かした家具 (要望文で「いらない」と書かれた家具を除いたもの)
  Result = Data.define(:title, :comment, :after_scene, :items, :total_price, :planned_by, :analysis, :kept_object_ids)

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
    plan = CoordinationPlanner.call(prompt: @coordination.prompt, budget: @coordination.budget, room: @scene["room"],
                                    kept_objects: kept_objects, user_id: @coordination.room.user_id, previous:)
    removed, kept = kept_objects.partition { |object| plan.removed_object_ids.include?(object["id"]) }
    # kept_object_ids が空だと「全部活かす」の意味になるので、全部外すことはしない
    removed, kept = [], kept_objects if kept.empty?

    by_slot = plan.candidates.group_by(&:slot) # 枠の優先順・各枠はおすすめ順
    chosen = choose_within_budget(by_slot)
    placed = []
    loop do
      reserved_ids = chosen.values.map { |item| "item-#{item.id}" }
      placed = place_choices(chosen, by_slot, kept)
      # 編集済みの代替商品を採用したら、先行する枠もその配置を避けて置き直す。
      newly_kept_edit = placed.any? do |entry|
        id = "item-#{entry[:item].id}"
        @coordination.edited_objects.any? { |edit| edit["id"] == id } && !reserved_ids.include?(id)
      end
      break unless newly_kept_edit

      chosen = placed.to_h { |entry| [ entry[:slot], entry[:item] ] }
    end

    placed.each.with_index(1) { |p, marker| p[:placement].object["marker"] = marker }

    Result.new(
      title: plan.title,
      comment: comment(plan, placed, kept, removed),
      after_scene: { "room" => @scene["room"], "objects" => kept + placed.map { |p| p[:placement].object } },
      items: placed.map.with_index(1) { |p, marker| item_json(p[:item], p[:placement].note, marker) },
      total_price: placed.sum { |p| p[:item].price },
      planned_by: plan.planned_by,
      # 精度の確認用: Gemini の回答と、実際に採用した商品
      analysis: plan.analysis.merge("placed_item_ids" => placed.map { |p| p[:item].id }, "base_coordination_id" => @coordination.base_coordination_id),
      kept_object_ids: kept.map { |object| object["id"] }
    )
  end

  private

  def place_choices(chosen, by_slot, kept)
    candidates = by_slot.values.flatten.index_by { |item| "item-#{item.id}" }
    edits = @coordination.edited_objects.filter_map do |edit|
      item = candidates[edit["id"]]
      edit.merge("slot" => item.slot) if item
    end
    layout = SlotLayout.new(@scene, kept, edited_objects: edits, reserved_object_ids: chosen.values.map { |item| "item-#{item.id}" })
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

  # 追加の指示のときの前回のコーデ。前回の商品を引き継ぐのに使う
  def previous
    base = @coordination.base_coordination
    return unless base&.status == "done"

    CoordinationPlanner::Previous.new(prompt: base.prompt, title: base.title, items: base.items.map { |item| item.slice("item_id", "slot", "name") })
  end

  # kept_object_ids が空なら今ある家具をすべて活かす
  def kept_objects
    objects = @scene["objects"]
    ids = @coordination.kept_object_ids
    ids.blank? ? objects : objects.select { |o| ids.include?(o["id"]) }
  end

  # コンセプト (Gemini) + 実際に置いた商品 + 活かした家具 + 断り書き (Gemini)。
  # 商品の部分は置いた結果から組み立てるので、予算や置き場所で外れた商品には触れない
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
      "placement_note" => note
    }
  end
end
