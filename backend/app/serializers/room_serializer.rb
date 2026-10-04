class RoomSerializer
  include Alba::Resource

  attributes :id, :shape, :status, :scene, :analyzed_by, :error_message

  attribute(:photo_count) { |room| room.photos.size }
  attribute(:tatami) { |room| room.tatami.to_f }
  attribute(:created_at) { |room| room.created_at.iso8601 }
end
