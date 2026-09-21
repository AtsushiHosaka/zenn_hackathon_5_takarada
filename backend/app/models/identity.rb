class Identity < ApplicationRecord
  # jti を打ち直すことでトークンを失効させる (DELETE /api/v1/logout)
  include Devise::JWT::RevocationStrategies::JTIMatcher

  # :database_authenticatable -> encrypted_password と valid_password?
  # :validatable              -> email の形式・一意性とパスワード長
  # :jwt_authenticatable      -> Warden の JWT ストラテジで認証
  devise :database_authenticatable, :validatable,
         :jwt_authenticatable, jwt_revocation_strategy: self

  belongs_to :user

  normalizes :email, with: ->(email) { email.strip.downcase }
end
