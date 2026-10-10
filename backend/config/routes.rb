Rails.application.routes.draw do
  # Swagger UI: http://localhost:3000/api-docs
  mount Rswag::Ui::Engine => "/api-docs"
  mount Rswag::Api::Engine => "/api-docs"

  get "up" => "rails/health#show", as: :rails_health_check

  # devise のマッピング (:identity スコープ) だけ作り、URL は下で明示的に定義する
  devise_for :identities, skip: :all

  devise_scope :identity do
    namespace :api do
      namespace :v1 do
        post   "signup", to: "registrations#create"
        post   "login",  to: "sessions#create"
        delete "logout", to: "sessions#destroy"
      end
    end
  end

  namespace :api do
    namespace :v1 do
      get "me", to: "me#show"
      resources :users, only: %i[index show update destroy]
      post "uploads", to: "uploads#create"
      # 開発用の受け口 (本番は GCS が直接受ける)。key は photos/users/<user_id>/<uuid>/0.jpg の形 (期限付き署名を検証)
      put "uploads/*key", to: "uploads#update", format: false

      resources :furniture_models, only: %i[index show]
      resources :furniture_searches, only: :create
      resources :rooms, only: %i[index create show] do
        resources :coordinations, only: :create
      end
      resources :coordinations, only: :show

      # 家具・商品の管理画面用。管理者 (users.admin) だけ (Admin::BaseController)
      namespace :admin do
        get "furniture_details/export", to: "furniture_details#export"
        resources :furniture_details, only: %i[index create update destroy]
        resources :furniture_models, only: %i[index update]
      end
    end
  end
end
