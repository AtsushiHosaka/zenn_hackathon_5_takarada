class CoordinationSerializer
  include Alba::Resource

  attributes :id, :room_id, :status, :prompt, :budget, :kept_object_ids,
             :title, :comment, :after_scene, :items, :total_price, :error_message

  # ビフォー/アフター切り替え用に部屋の元のシーンも返す
  attribute(:before_scene) { |coordination| coordination.room.scene }
  attribute(:created_at) { |coordination| coordination.created_at.iso8601 }
end
