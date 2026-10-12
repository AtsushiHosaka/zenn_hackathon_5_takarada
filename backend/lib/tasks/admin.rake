namespace :admin do
  desc "Let a user use the admin screen (/admin): rails 'admin:grant[user@example.com]'"
  task :grant, [ :email ] => :environment do |_task, args|
    set_admin(args[:email], true)
  end

  desc "Stop a user from using the admin screen: rails 'admin:revoke[user@example.com]'"
  task :revoke, [ :email ] => :environment do |_task, args|
    set_admin(args[:email], false)
  end

  desc "List users who can use the admin screen"
  task list: :environment do
    User.where(admin: true).preload(:identity).order(:id).each { |user| puts "#{user.id}\t#{user.email}\t#{user.name}" }
  end

  def set_admin(email, admin)
    abort "Pass an email address, e.g. rails 'admin:grant[user@example.com]'" if email.blank?
    identity = Identity.find_by(email: email.strip.downcase) or abort "No user with email #{email}"
    identity.user.update!(admin:)
    puts "#{identity.email}: admin=#{admin}"
  end
end
