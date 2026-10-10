3.times do |i|
  email = "user#{i + 1}@example.com"
  next if Identity.exists?(email: email)

  User.create!(
    name: "User #{i + 1}",
    identity_attributes: { email: email, password: "password" }
  )
end

# 手元だけ: 管理画面 (/admin) 用の管理者 admin@example.com / password。
# パスワードが公開されているので本番には作らない (本番は実在のアカウントに rails admin:grant で付ける)
if Rails.env.development? && !Identity.exists?(email: "admin@example.com")
  User.create!(name: "Admin", admin: true, identity_attributes: { email: "admin@example.com", password: "password" })
end

puts "seeded #{User.count} users"

characters = CharacterImporter.call
puts "seeded #{characters.fetch(:franchises)} franchises and #{characters.fetch(:characters)} characters"

furnitures = FurnitureImporter.call
puts "seeded #{furnitures.fetch(:models)} furnitures"

textures = FurnitureTextureImporter.call
puts "seeded #{textures.fetch(:textures)} furniture textures"

# 商品は DB が正。空のときだけ初期データを入れる
details = FurnitureDetailImporter.call
puts details.fetch(:skipped) ? "kept #{FurnitureDetail.count} furniture details" : "seeded #{details.fetch(:details)} furniture details for #{details.fetch(:furnitures)} furnitures"
