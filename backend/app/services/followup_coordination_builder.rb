# 追加の指示を、前回の完成状態 (after_scene) への差分として当てる。
# 変える範囲は FollowupChangeScope が決め、範囲の外の家具・配置・色はここで前回のまま残す。
# 交換は元の場所・同じ種類の商品から選ぶ。置けない・候補が無いときは元の家具を残し、理由をコメントに書く。
class FollowupCoordinationBuilder
  # 1 つしか置けない枠。すでにあるときの「追加」は交換として扱う
  SINGLE_SLOTS = %w[bed_cover curtain rug].freeze
  # 床の占有に数えない、家具の上・壁・窓に付く枠
  ATTACHED_SLOTS = %w[rug curtain wall_decor desk_top cushion blanket].freeze

  # 同じ要望のやり直しと、キャラクターテーマの変更は部屋全体の作り直しとして通常の流れで扱う
  def self.applies?(coordination)
    base = coordination.base_coordination
    base && base.status == "done" && base.after_scene.is_a?(Hash) && base.after_scene["objects"].is_a?(Array) &&
      coordination.prompt.to_s.strip != base.prompt.to_s.strip && coordination.character_theme_id == base.character_theme_id
  end

  def initialize(coordination)
    @coordination = coordination
    @base = coordination.base_coordination
    @scene = @base.after_scene.deep_dup
    @items = Array(@base.items).deep_dup
    @failures = []
    @changes = { "交換" => [], "追加" => [], "削除" => [] }
    @replaced_existing_ids = []
  end

  def call
    apply_edits
    scope = FollowupChangeScope.call(@coordination, @scene, forced: screen_operations)
    return CoordinationBuilder.new(@coordination).call if scope["full_redesign"]

    @failures << scope["clarification"] if scope["clarification"].present?
    %w[wall_color floor_color].each { |key| @scene["room"][key] = scope[key] if scope[key].present? }
    recolored = scope.values_at("wall_color", "floor_color").any?(&:present?)
    scope["operations"].select { |operation| operation["action"] == "remove" }.each { |operation| remove(find_object(operation["object_id"])) }
    requests = change_requests(scope)
    plan = plan_for(requests, scope["add_slots"] - requests.pluck(:slot)) if requests.any? || scope["add_slots"].any?
    place(requests, plan) if plan
    appearance = FurnitureProductAppearance.call(scene: @scene, items: @items)

    CoordinationBuilder::Result.new(
      # 部屋全体の色を変えたときだけ、タイトルも付け直す
      title: recolored && plan && !CharacterRoomTheme.find(@coordination.character_theme_id) ? plan.title : @base.title,
      comment: [ summary(recolored), plan&.note, *@failures ].compact.join,
      after_scene: appearance.fetch(:scene),
      items: appearance.fetch(:items),
      total_price: appearance.fetch(:items).sum { |item| item["price"].to_i },
      planned_by: plan&.planned_by || (gemini? ? "gemini" : "mock"),
      # 壁・床を変えていなければ、画面が要望文から推定し直した配色ではなく前回の配色を残す
      analysis: (@coordination.analysis || {}).deep_merge(plan&.analysis || {}).merge("change_scope" => scope, "base_coordination_id" => @base.id, "operation_failures" => @failures,
                                                                                    "placed_item_ids" => appearance.fetch(:items).pluck("item_id"),
                                                                                    **(recolored ? {} : { "room_palette_id" => @base.room_palette_id })),
      kept_object_ids: @scene["objects"].select { |object| object["source"] == "existing" }.pluck("id"),
      furniture_operations: result_operations
    )
  end

  private

  # 何を変えたかの説明。商品名は長いので短くし、多いときは点数でまとめる
  def summary(recolored)
    parts = @changes.reject { |_, labels| labels.empty? }.map do |action, labels|
      names = labels.uniq.map { |label| label.to_s.truncate(18) }
      "#{names.size > 2 ? "#{names.first(2).join('、')}など#{names.size}点" : names.join('、')}を#{action}"
    end
    parts.unshift("壁・床の色を変更") if recolored
    return "変更できる部分が無かったため、前回の部屋をそのまま残しました。" if parts.empty?

    "#{parts.join('、')}しました。ほかの家具・配置・色は前回のままです。"
  end

  def gemini?
    GeminiClient.configured?(user_id: @coordination.room.user_id)
  end

  def find_object(id)
    @scene["objects"].find { |object| object["id"] == id }
  end

  def item_for(object)
    @items.find { |item| item["marker"] == object["marker"] && item["item_id"] == object["item_id"] } if object["marker"]
  end

  def next_marker
    (@items.map { |item| item["marker"].to_i }.max || 0) + 1
  end

  # 画面で動かした位置・寸法・向き・色と、画面で選び直した商品、画面で足した家具を引き継ぐ
  def apply_edits
    known_ids = Array(@base.edited_objects).pluck("id")
    @coordination.input_scene["objects"].each do |object|
      # 前回より後に画面で足した家具だけを足す。前回までに外した家具を戻さない
      next unless object["id"].to_s.match?(Coordination::MANUAL_OBJECT_ID) && !find_object(object["id"]) && known_ids.exclude?(object["id"])

      @scene["objects"] << object
    end
    @coordination.edited_objects.each do |edit|
      object = find_object(edit["id"]) or next
      object.merge!(edit.slice("position", "size", "rotation_y", "color", "attach_to"))
      product_id = object["source"] == "existing" ? edit["replacement_furniture_detail_id"] : edit["furniture_detail_id"]
      product = FurnitureCandidates::Client.find_item(product_id)
      next unless product && product.id != object["item_id"]

      swap_product(object, product)
    end
  end

  # 画面で商品を選び直した家具。位置と寸法は画面のまま、商品だけを差し替える
  def swap_product(object, product)
    if object["source"] == "existing"
      marker = next_marker
      metadata = product.metadata.merge("group_id" => "replace:#{object['id']}", "replaces_object_id" => object["id"])
      @replaced_existing_ids << object["id"]
      @items << CoordinationBuilder.item_json(product.with(slot: "floor", metadata:), "調整した配置", marker)
      object.merge!("source" => "suggested", "slot" => "floor", "marker" => marker, "replaces_object_id" => object["id"])
    elsif (item = item_for(object))
      metadata = product.metadata.merge(item.fetch("product_metadata", {}).slice("group_id", "replaces_object_id"))
      item.replace(CoordinationBuilder.item_json(product.with(slot: item["slot"], metadata:), item["placement_note"], item["marker"]))
    else
      return
    end
    @changes["交換"] << object["label"]
    object.merge!("item_id" => product.id, "furniture_detail_id" => product.id, "label" => product.name)
  end

  # 画面の「入れ替える・外す・追加」のうち、前回から変わった分
  def screen_operations
    previous = Array(@base.furniture_operations).to_h { |operation| [ operation["object_id"], operation["action"] ] }
    operations = @coordination.furniture_operations.select do |operation|
      operation["action"] != "keep" && previous[operation["object_id"]] != operation["action"] && find_object(operation["object_id"])&.fetch("source", nil) == "existing"
    end
    remaining = Array(@base.additions).pluck("category")
    additions = @coordination.additions.pluck("category").reject { |category| (index = remaining.index(category)) && remaining.delete_at(index) }
    { "operations" => operations.map { |operation| operation.slice("object_id", "action") }, "add_categories" => additions }
  end

  # 家具を外す。上に載っている物・その家具に付けた物も一緒に外す
  def remove(object, replacing: false)
    return unless object

    @scene["objects"].select { |child| child["attach_to"] == object["id"] }.each { |child| remove(child) } unless replacing
    @scene["objects"].delete(object)
    @items.delete(item_for(object))
    @changes["削除"] << object["label"] unless replacing
  end

  # 交換と追加を、AI に選ばせる単位 (グループ) にする
  def change_requests(scope)
    replaced = scope["operations"].select { |operation| operation["action"] == "replace" }.filter_map { |operation| find_object(operation["object_id"]) }
    # 1 つしか置けない枠は、すでにあれば交換にする
    replaced += scope["add_slots"].filter_map { |slot| @scene["objects"].find { |object| object["slot"] == slot } if SINGLE_SLOTS.include?(slot) }
    requests = replaced.uniq.map { |object| { group: "replace:#{object['id']}", slot: object["slot"] || "floor", category: object["category"], object: } }
    requests + scope["add_categories"].each_with_index.map { |category, index| { group: "add:#{index}", slot: "floor", category:, object: nil } }
  end

  def plan_for(requests, add_slots)
    client = FurnitureCandidates.client(characters: wanted_characters)
    character_theme = CharacterRoomTheme.suggestion_profile(@coordination.character_theme_id, palette_id: @base.room_palette_id)
    preference = FurnitureQuery.call(@coordination.prompt, user_id: @coordination.room.user_id) if gemini? || character_theme
    if character_theme
      literal_color = (FurnitureCandidates::Colors::THEME_PATTERNS.to_a + FurnitureCandidates::Colors::PATTERNS.to_a).find { |_, pattern| pattern.match?(@coordination.prompt) }&.first
      preference = preference.with(color: literal_color)
    end
    @candidates = requests.flat_map do |request|
      object = request[:object]
      client.search(prompt: @coordination.prompt, slots: [ request[:slot] ], categories: [ request[:category] ], preference:, character_theme:).fetch(request[:slot], [])
        .select { |item| item.category == request[:category] && item.id != object&.fetch("item_id", nil) }.map do |item|
          origin = { "replaces_object_id" => object&.fetch("id"), "preferred_position" => object&.fetch("position"), "preferred_rotation" => object&.fetch("rotation_y"), "target_size" => object&.fetch("size") }.compact
          item.with(metadata: item.metadata.merge("group_id" => request[:group], **origin))
        end
    end
    previous = CoordinationPlanner::Previous.new(prompt: @base.prompt, title: @base.title, items: [])
    CoordinationPlanner.call(prompt: CharacterRoomTheme.prompt(@coordination.prompt, @coordination.character_theme_id), room: @scene["room"], kept_objects: @scene["objects"],
                             user_id: @coordination.room.user_id, client:, additional_candidates: @candidates, previous:, slots: add_slots, preference:, character_theme:)
  end

  def wanted_characters
    query = CharacterQuery.call(@coordination.prompt, llm: false)
    themed = @coordination.character_theme_id ? Character.where(theme_id: @coordination.character_theme_id).pluck(:character_key) : []
    query.characters + Character.joins(:franchise).where(franchises: { franchise_key: query.franchises }).pluck(:character_key) + themed
  end

  # AI が選んだ商品を、選ばれた順に置く。置けなければ同じグループの次の候補を試す
  def place(requests, plan)
    gemini = plan.planned_by == "gemini"
    by_group = (gemini ? plan.candidates : @candidates + plan.candidates).group_by { |item| item.metadata["group_id"] || item.slot }
    chosen = if gemini
      Array(plan.analysis["selection"]).filter_map { |selection| [ selection["group_id"], by_group[selection["group_id"]]&.find { |item| item.id == selection["item_id"] } ] }.select(&:last)
    else
      by_group.map { |group, items| [ group, items.first ] }
    end
    done = []
    chosen.each do |group, item|
      request = requests.find { |entry| entry[:group] == group }
      alternatives = by_group[group].reject { |candidate| chosen.include?([ group, candidate ]) }
      done << group if [ item, *alternatives ].any? { |candidate| place_item(candidate, request&.fetch(:object)) }
    end
    (by_group.keys - requests.pluck(:group) - done).each do |slot|
      @failures << "追加する#{CoordinationPlanner::Gemini::SLOT_LABELS.fetch(slot, slot)}は、置ける場所か合う商品が無かったため追加しませんでした。"
    end
    requests.each do |request|
      next if done.include?(request[:group])

      label = request[:object] ? request[:object]["label"] : CoordinationPlanner::Gemini::SLOT_LABELS.fetch(request[:category], request[:category])
      @failures << (request[:object] ? "#{label}は、条件と配置に合う交換候補が無かったため元のまま残しました。" : "追加する#{label}は、条件と配置に合う商品が無かったため追加しませんでした。")
    end
  end

  def place_item(item, original)
    id = SlotLayout.object_id_for(item)
    return false if @scene["objects"].any? { |object| object["id"] == id && object != original }

    others = @scene["objects"] - [ original ]
    # ベッドカバーはクッションやブランケットを載せる面なので、家具の側に入れる
    attached, occupants = others.partition do |object|
      ATTACHED_SLOTS.include?(object["slot"]) || (object["source"] == "suggested" && object["slot"] != "bed_cover" && object["attach_to"] && object["position"]["y"] > 0.05)
    end
    # 床に置く家具は SlotLayout が元の位置を優先する。それ以外の交換は、元の位置・向きをそのまま使う
    edit = if original && item.slot != "floor"
      original.slice("position", "rotation_y", "size", "attach_to").merge("id" => id, "slot" => item.slot, "color" => item.color)
    end
    placement = [ edit, nil ].uniq.lazy.filter_map do |pose|
      layout = SlotLayout.new(@scene, occupants, edited_objects: [ pose ].compact)
      layout.occupy(attached)
      layout.place(item)
    end.first
    return false unless placement

    object = placement.object
    marker = original&.fetch("marker", nil) || next_marker
    object.merge!("marker" => marker, "furniture_detail_id" => item.id)
    if original
      object["attach_to"] ||= original["attach_to"]
      carry_attached(original, object)
      @replaced_existing_ids << original["id"] if original["source"] == "existing"
      remove(original, replacing: true)
    end
    @scene["objects"] << object
    @items << CoordinationBuilder.item_json(item, placement.note, marker)
    original ? @changes["交換"] << original["label"] : @changes["追加"] << item.name
    true
  end

  # 交換した家具の上に載っていた物を、新しい家具に付け替える。位置と高さの差だけ動かす
  def carry_attached(original, object)
    delta = %w[x z].to_h { |axis| [ axis, object["position"][axis] - original["position"][axis] ] }
    delta["y"] = (object["size"]["h"] - original["size"]["h"]) * (object["category"] == "sofa" ? 0.5 : 1)
    @scene["objects"].select { |child| child["attach_to"] == original["id"] }.each do |child|
      child["attach_to"] = object["id"]
      next if child["position"]["y"] <= 0.05

      child["position"] = child["position"].to_h { |axis, value| [ axis, (value + delta.fetch(axis, 0)).round(3) ] }
    end
  end

  def result_operations
    existing_ids = @scene["objects"].select { |object| object["source"] == "existing" }.pluck("id")
    previous = Array(@base.furniture_operations).to_h { |operation| [ operation["object_id"], operation["action"] ] }
    @coordination.furniture_operations.map do |operation|
      id = operation["object_id"]
      action = if existing_ids.include?(id) then "keep"
      elsif @replaced_existing_ids.include?(id) then "replace"
      else previous[id].presence_in(%w[replace remove]) || "remove"
      end
      operation.merge("action" => action)
    end
  end
end
