# 未認証時 (Warden が throw(:warden) したとき) のレスポンス。
# 既定の Devise::FailureApp は Accept ヘッダ次第でプレーンテキストを返すので、
# 他のエラーと同じ { "error": "..." } の JSON に揃える。
class JsonFailureApp < Devise::FailureApp
  def respond
    self.status = 401
    self.content_type = "application/json"
    self.response_body = { error: i18n_message }.to_json
  end
end
