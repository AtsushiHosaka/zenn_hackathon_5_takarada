3.times do |i|
  email = "user#{i + 1}@example.com"
  next if Identity.exists?(email: email)

  User.create!(
    name: "User #{i + 1}",
    identity_attributes: { email: email, password: "password" }
  )
end

puts "seeded #{User.count} users"

catalog = FurnitureModelImporter.call
puts "seeded #{catalog.fetch(:models)} furniture models and #{catalog.fetch(:bindings)} bindings"
