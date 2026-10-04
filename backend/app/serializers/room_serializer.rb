class RoomSerializer
  include Alba::Resource

  attributes :id, :shape, :status, :scene, :error_message

  attribute(:tatami) { |room| room.tatami.to_f }
  attribute(:created_at) { |room| room.created_at.iso8601 }
end
