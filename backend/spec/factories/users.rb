FactoryBot.define do
  factory :user do
    name { Faker::Name.name }

    # ログインに使える状態で作る。パスワードを変えたい場合は
    #   create(:user, identity: build(:identity, password: "..."))
    identity { build(:identity) }
  end

  factory :identity do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { "password" }
  end
end
