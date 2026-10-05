class CoordinationSerializer
  include Alba::Resource

  attributes :id, :room_id, :status, :prompt, :budget, :kept_object_ids,
             :title, :comment, :items, :total_price, :planned_by, :base_coordination_id, :error_message

  attribute(:after_scene) { |coordination| ModelResolver.call(coordination.after_scene) }
  # ビフォー/アフター切り替え用に部屋の元のシーンも返す
  attribute(:before_scene) { |coordination| ModelResolver.call(coordination.room.scene) }
  attribute(:created_at) { |coordination| coordination.created_at.iso8601 }
end
