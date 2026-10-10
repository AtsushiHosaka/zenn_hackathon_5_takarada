# users のレスポンス表現。email は identity 側の値を User#email が delegate している。
#
# 日時は必ず iso8601 で出す。素の to_json だと ActiveSupport が小数秒付き
# ("2026-01-01T00:00:00.000Z") にするため、ブロックで明示している。
class UserSerializer
  include Alba::Resource

  attributes :id, :name, :email, :admin

  attribute(:created_at) { |user| user.created_at.iso8601 }
  attribute(:updated_at) { |user| user.updated_at.iso8601 }
end
