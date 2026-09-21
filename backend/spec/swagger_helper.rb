require "rails_helper"

RSpec.configure do |config|
  config.openapi_root = Rails.root.join("swagger").to_s

  # `bundle exec rails rswag` を叩くと、ここの定義 + 各 spec から
  # swagger/v1/swagger.yaml が生成される
  config.openapi_specs = {
    "v1/swagger.yaml" => {
      openapi: "3.0.1",
      info: {
        title: "API V1",
        version: "v1",
        description: "Rails API"
      },
      paths: {},
      servers: [
        {
          url: "http://localhost:3000",
          description: "Local"
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: :http,
            scheme: :bearer,
            bearerFormat: "JWT",
            description: "POST /api/v1/login のレスポンスヘッダ Authorization の値をそのまま使う"
          }
        },
        schemas: {
          User: {
            type: :object,
            properties: {
              id: { type: :integer, example: 1 },
              name: { type: :string, example: "Taro Yamada" },
              email: { type: :string, format: :email, example: "taro@example.com" },
              created_at: { type: :string, format: "date-time" },
              updated_at: { type: :string, format: "date-time" }
            },
            required: %w[id name email created_at updated_at]
          },
          SignupInput: {
            type: :object,
            properties: {
              user: {
                type: :object,
                properties: {
                  name: { type: :string, example: "Taro Yamada" },
                  email: { type: :string, format: :email, example: "taro@example.com" },
                  password: { type: :string, format: :password, minLength: 8, example: "password" }
                },
                required: %w[name email password]
              }
            },
            required: %w[user]
          },
          LoginInput: {
            type: :object,
            properties: {
              identity: {
                type: :object,
                properties: {
                  email: { type: :string, format: :email, example: "user1@example.com" },
                  password: { type: :string, format: :password, example: "password" }
                },
                required: %w[email password]
              }
            },
            required: %w[identity]
          },
          UserInput: {
            type: :object,
            properties: {
              user: {
                type: :object,
                properties: {
                  name: { type: :string, example: "Taro Yamada" }
                },
                required: %w[name]
              }
            },
            required: %w[user]
          },
          ValidationErrors: {
            type: :object,
            properties: {
              errors: {
                type: :array,
                items: { type: :string },
                example: [ "Identity email has already been taken" ]
              }
            },
            required: %w[errors]
          },
          Unauthorized: {
            type: :object,
            properties: {
              error: { type: :string, example: "メールアドレスまたはパスワードが違います" }
            },
            required: %w[error]
          },
          NotFound: {
            type: :object,
            properties: {
              error: { type: :string, example: "Couldn't find User with 'id'=999" }
            },
            required: %w[error]
          }
        }
      }
    }
  }

  config.openapi_format = :yaml
end
