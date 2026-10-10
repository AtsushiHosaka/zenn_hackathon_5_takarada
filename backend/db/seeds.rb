3.times do |i|
  email = "user#{i + 1}@example.com"
  next if Identity.exists?(email: email)

  User.create!(
    name: "User #{i + 1}",
    identity_attributes: { email: email, password: "password" }
  )
end

# 手元では user1 を管理者にして、管理画面 (/admin) をすぐ使えるようにする。本番は rails admin:grant で付ける
if Rails.env.development?
  User.joins(:identity).where(identities: { email: "user1@example.com" }).update_all(admin: true)
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
