# rails console のプロンプトを irb(dev):001 > / irb(prod):001 > の形にする。
# 本番は赤く出るので、うっかり本番で叩いていないか目で気づける。
#
# config/application.rb の `console do` では効かない。IRB.setup が IRB.conf を
# 初期化したあとに .irbrc が読まれ、その後 Rails がプロンプトを上書きするため、
# 実行時に評価される IRB_RC で最後に差し替える必要がある。
if defined?(Rails) && Rails.respond_to?(:env)
  label =
    case Rails.env
    when "development" then defined?(IRB::Color) ? IRB::Color.colorize("dev", [ :BLUE ]) : "dev"
    when "production"  then defined?(IRB::Color) ? IRB::Color.colorize("prod", [ :RED ]) : "prod"
    else Rails.env.to_s
    end

  previous_rc = IRB.conf[:IRB_RC]

  IRB.conf[:IRB_RC] = lambda do |context|
    previous_rc&.call(context)
    context.prompt_i = "irb(#{label}):%03n > "
    context.prompt_s = "irb(#{label}):%03n%l "
    context.prompt_c = "irb(#{label}):%03n * "
    context.return_format = "=> %s\n"
  end
end
