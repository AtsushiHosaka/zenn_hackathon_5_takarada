# 未設定は許容するが、不正な配信元設定は応答時ではなく起動時に通知する。
# to_prepareは開発環境のautoload/reloadにも対応し、DBへの接続は行わない。
Rails.application.config.to_prepare do
  Furniture3DModel.asset_base_url
end
