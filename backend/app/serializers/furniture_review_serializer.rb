class FurnitureReviewSerializer
  include Alba::Resource

  attributes :verdict, :summary, :color, :size, :mood, :suggestion, :reviewed_by
end
