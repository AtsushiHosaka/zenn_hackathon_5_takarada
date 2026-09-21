class User < ApplicationRecord
  # 認証情報 (email / パスワード) は identities 側が持つ
  has_one :identity, dependent: :destroy
  accepts_nested_attributes_for :identity

  validates :name, presence: true, length: { maximum: 50 }

  delegate :email, to: :identity, allow_nil: true
end
