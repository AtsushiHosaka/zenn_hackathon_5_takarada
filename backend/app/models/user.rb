class User < ApplicationRecord
  # 認証情報 (email / パスワード) は identities 側が持つ
  has_one :identity, dependent: :destroy
  has_many :rooms, dependent: :destroy
  has_many :coordinations, through: :rooms
  accepts_nested_attributes_for :identity

  validates :name, presence: true, length: { maximum: 50 }
  # 家具・商品の管理画面を使えるか。API からは見えず変えられない (rails admin:grant / admin:revoke で付け外しする)。
  # 画面は /api/v1/admin/* が 403 を返すかどうかで判断する
  validates :admin, inclusion: { in: [ true, false ] }

  delegate :email, to: :identity, allow_nil: true
end
