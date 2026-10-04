# コーデを組み立てる: 商品候補を選ぶ (CoordinationPlanner) → 枠に配置する (SlotLayout) → 予算内に収める。
# 置き場所が無い商品・予算を超える商品は採用しないので、購入リンク一覧と 3D の表示は常に一致する。
class CoordinationBuilder
  Result = Data.define(:title, :comment, :after_scene, :items, :total_price)

  def self.call(coordination)
    new(coordination).call
  end

  def initialize(coordination)
    @coordination = coordination
    @scene = coordination.room.scene
  end

  def call
    kept = kept_objects
    layout = SlotLayout.new(@scene, kept)
    plan = CoordinationPlanner.call(prompt: @coordination.prompt, budget: @coordination.budget)

    by_slot = plan.candidates.group_by(&:slot) # 枠の優先順・各枠はおすすめ順
    placed = []
    choose_within_budget(by_slot).each do |slot, item|
      # 置き場所が無ければ、同じ枠のより安い候補で試す (予算は超えない)
      options = [ item, *by_slot[slot].select { |c| c != item && c.price <= item.price } ]
      options.each do |candidate|
        placement = layout.place(candidate) or next
        placed << { item: candidate, placement: }
        break
      end
    end

    placed.each.with_index(1) { |p, marker| p[:placement].object["marker"] = marker }

    Result.new(
      title: plan.title,
      comment: comment(placed, kept),
      after_scene: { "room" => @scene["room"], "objects" => kept + placed.map { |p| p[:placement].object } },
      items: placed.map.with_index(1) { |p, marker| item_json(p[:item], p[:placement].note, marker) },
      total_price: placed.sum { |p| p[:item].price }
    )
  end

  private

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
    ids.blank? ? objects : objects.select { |o| ids.include?(o["id"]) }
  end

  def comment(placed, kept)
    added = placed.first(3).map { |p| "#{p[:item].name} (#{p[:placement].note})" }.join("、")
    kept_labels = kept.map { |o| o["label"] }.join("と")
    text = "#{added} などを追加しました。"
    text += "今の#{kept_labels}はそのまま活かしています。" if kept_labels.present?
    text
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
