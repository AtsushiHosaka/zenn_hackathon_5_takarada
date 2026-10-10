class RoomSerializer
  include Alba::Resource

  attributes :id, :shape, :status, :analyzed_by, :error_message
  has_one :latest_coordination, resource: CoordinationSerializer

  attribute(:scene) { |room| FurnitureModelMatcher.call(room.scene) }
  attribute(:tatami) { |room| room.tatami.to_f }
  attribute(:created_at) { |room| room.created_at.iso8601 }
end
