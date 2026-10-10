3.times do |i|
  email = "user#{i + 1}@example.com"
  next if Identity.exists?(email: email)

  User.create!(
    name: "User #{i + 1}",
    identity_attributes: { email: email, password: "password" }
  )
end

puts "seeded #{User.count} users"

furnitures = FurnitureImporter.call
puts "seeded #{furnitures.fetch(:models)} furnitures and #{furnitures.fetch(:bindings)} bindings"

details = FurnitureDetailImporter.call
puts "seeded #{details.fetch(:details)} furniture details for #{details.fetch(:furnitures)} furnitures"
