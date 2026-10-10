class User < ApplicationRecord
  # 認証情報 (email / パスワード) は identities 側が持つ
  has_one :identity, dependent: :destroy
  has_many :rooms, dependent: :destroy
  has_many :coordinations, through: :rooms
  accepts_nested_attributes_for :identity

  validates :name, presence: true, length: { maximum: 50 }

  delegate :email, to: :identity, allow_nil: true

  # 家具・商品の管理画面を使えるか。ADMIN_EMAILS (カンマ区切りのメールアドレス) に入っている人だけ
  def admin?
    email.present? && ENV["ADMIN_EMAILS"].to_s.split(",").map { |value| value.strip.downcase }.include?(email.downcase)
  end
end
