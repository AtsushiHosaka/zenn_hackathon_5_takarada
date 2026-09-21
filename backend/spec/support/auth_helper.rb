module AuthHelper
  # rswag の `let(:Authorization)` に渡す値を作る。
  # ログインを経由せず、Warden (devise-jwt) と同じエンコーダで直接トークンを発行する。
  def bearer_token_for(user)
    token, = Warden::JWTAuth::UserEncoder.new.call(user.identity, :identity, nil)
    "Bearer #{token}"
  end
end
