3.times do |i|
  email = "user#{i + 1}@example.com"
  next if Identity.exists?(email: email)

  User.create!(
    name: "User #{i + 1}",
    identity_attributes: { email: email, password: "password" }
  )
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
