class RoomSerializer
  include Alba::Resource

  attributes :id, :shape, :status, :analyzed_by, :error_message

  attribute(:scene) { |room| ModelResolver.call(room.scene) }
  attribute(:tatami) { |room| room.tatami.to_f }
  attribute(:created_at) { |room| room.created_at.iso8601 }
end
