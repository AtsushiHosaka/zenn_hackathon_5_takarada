# 追加・交換ごとに候補グループを作る。同じSKUを複数購入しても配置IDは別になる。
class FurnitureOperationPlanner
  def self.call(coordination, scene, client:, candidate_limit: 3)
    operations = coordination.furniture_operations.select { |operation| operation["action"] == "replace" }.filter_map do |operation|
      original = scene.fetch("objects").find { |object| object["id"] == operation["object_id"] }
      { category: original["category"], group: "replace:#{original['id']}", original: } if original
    end
    operations += coordination.additions.each_with_index.map { |addition, index| { category: addition["category"], group: "add:#{index}" } }
    return [] if operations.empty?

    by_category = {}
    operations.flat_map do |operation|
      category = operation[:category]
      candidates = by_category[category] ||= client.search(prompt: coordination.generation_prompt, theme: nil, slots: [ "floor" ], categories: [ category ], max_price: coordination.budget_limit).fetch("floor", [])
      candidates.select { |item| item.category == category }.first(candidate_limit).map do |item|
        original = operation[:original]
        item.with(metadata: item.metadata.merge(
          "group_id" => operation[:group], "replaces_object_id" => original&.fetch("id"),
          "preferred_position" => original&.fetch("position"), "preferred_rotation" => original&.fetch("rotation_y"),
          "target_size" => original&.fetch("size")
        ))
      end
    end
  end
end
