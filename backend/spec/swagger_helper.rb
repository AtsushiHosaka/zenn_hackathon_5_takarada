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
          },
          Size: {
            type: :object,
            description: "メートル。w: 幅 (ローカル x), h: 高さ, d: 奥行き (ローカル z)",
            properties: {
              w: { type: :number, example: 0.97 },
              h: { type: :number, example: 0.45 },
              d: { type: :number, example: 1.95 }
            },
            required: %w[w h d]
          },
          Position: {
            type: :object,
            description: "物体の底面中心 (メートル)。原点は北西の床の角、x は東向き、y は上、z は南向き",
            properties: {
              x: { type: :number, example: 0.51 },
              y: { type: :number, example: 0.0 },
              z: { type: :number, example: 1.0 }
            },
            required: %w[x y z]
          },
          Window: {
            type: :object,
            properties: {
              id: { type: :string, example: "window-1" },
              wall: { type: :string, enum: %w[north south east west], example: "south" },
              center: { type: :number, description: "壁に沿った窓の中心位置 (north/south は x、east/west は z)", example: 1.35 },
              width: { type: :number, example: 1.2 },
              bottom: { type: :number, description: "床から窓の下端までの高さ", example: 0.9 },
              height: { type: :number, example: 1.1 }
            },
            required: %w[id wall center width bottom height]
          },
          RoomShape: {
            type: :object,
            properties: {
              width: { type: :number, description: "東西方向 (x) の長さ", example: 2.7 },
              depth: { type: :number, description: "南北方向 (z) の長さ", example: 3.6 },
              height: { type: :number, example: 2.4 },
              wall_color: { type: :string, example: "#f4f1ec" },
              floor_color: { type: :string, example: "#c8a97e" },
              windows: { type: :array, items: { "$ref" => "#/components/schemas/Window" } }
            },
            required: %w[width depth height wall_color floor_color windows]
          },
          SceneObject: {
            type: :object,
            properties: {
              id: { type: :string, example: "bed-1" },
              source: { type: :string, enum: %w[existing suggested], description: "existing: 今ある家具, suggested: AI の追加提案", example: "existing" },
              category: { type: :string, example: "bed" },
              label: { type: :string, example: "ベッド" },
              size: { "$ref" => "#/components/schemas/Size" },
              position: { "$ref" => "#/components/schemas/Position" },
              rotation_y: { type: :integer, enum: [ 0, 90, 180, 270 ], description: "度数。正面 (ローカル +z) が 0: 南, 90: 東, 180: 北, 270: 西 を向く (three.js の rotation.y と同じ)", example: 0 },
              color: { type: :string, example: "#f2f0eb" },
              model_url: { type: :string, nullable: true, description: "GLB の URL。null なら category と size から箱などで代わりに描く", example: nil },
              slot: { type: :string, nullable: true, enum: [ nil, "bed_cover", "curtain", "rug", "wall_decor", "light", "display", "cushion", "desk_top" ], description: "suggested の置き場所の枠", example: nil },
              attach_to: { type: :string, nullable: true, description: "付けた先の家具・窓の id", example: nil },
              item_id: { type: :integer, nullable: true, description: "suggested の商品 id (Coordination.items と対応)", example: nil },
              marker: { type: :integer, nullable: true, description: "suggested の番号マーカー (Coordination.items と対応)", example: nil }
            },
            required: %w[id source category label size position rotation_y color model_url slot attach_to item_id marker]
          },
          Scene: {
            type: :object,
            properties: {
              room: { "$ref" => "#/components/schemas/RoomShape" },
              objects: { type: :array, items: { "$ref" => "#/components/schemas/SceneObject" } }
            },
            required: %w[room objects]
          },
          UploadInput: {
            type: :object,
            properties: {
              uploads: {
                type: :array,
                maxItems: 4,
                items: {
                  type: :object,
                  properties: {
                    content_type: { type: :string, enum: %w[image/jpeg image/png image/webp], example: "image/jpeg" },
                    size: { type: :integer, maximum: 10_485_760, description: "バイト数。署名に含めるので実際に送る大きさと一致させる", example: 284_113 }
                  },
                  required: %w[content_type size]
                }
              }
            },
            required: %w[uploads]
          },
          Upload: {
            type: :object,
            properties: {
              key: { type: :string, description: "POST /api/v1/rooms の photo_keys に渡す", example: "photos/01a105cb-f338-72a2-b843-7de9d31431a1/0.jpg" },
              upload_url: { type: :string, description: "この URL へ写真を PUT する。Content-Type だけを付け、他のヘッダは足さない (署名と食い違うと 403)", example: "https://storage.googleapis.com/example-uploads/photos/01a105cb-f338-72a2-b843-7de9d31431a1/0.jpg?X-Goog-Algorithm=GOOG4-RSA-SHA256" }
            },
            required: %w[key upload_url]
          },
          RoomInput: {
            type: :object,
            properties: {
              room: {
                type: :object,
                properties: {
                  tatami: { type: :number, minimum: 3, maximum: 30, description: "部屋の広さ (畳)", example: 6 },
                  shape: { type: :string, enum: %w[square standard long], description: "部屋の形。square: 正方形に近い (1:1.15), standard: やや縦長 (3:4), long: 細長い (1:2)", example: "standard" },
                  photo_keys: { type: :array, items: { type: :string }, description: "POST /api/v1/uploads で得た key。アップロード済みのものだけ受け付ける。省略すると写真なしで解析する", example: [] }
                },
                required: %w[tatami shape]
              }
            },
            required: %w[room]
          },
          Room: {
            type: :object,
            properties: {
              id: { type: :integer, example: 1 },
              tatami: { type: :number, example: 6.0 },
              shape: { type: :string, enum: %w[square standard long], example: "standard" },
              status: { type: :string, enum: %w[analyzing ready failed], example: "ready" },
              scene: { allOf: [ { "$ref" => "#/components/schemas/Scene" } ], nullable: true, description: "status が ready になると入る" },
              analyzed_by: { type: :string, nullable: true, enum: [ nil, "gemini", "mock" ], description: "gemini: 写真を AI で解析した / mock: 写真か API キーが無く、決まった家具を置いたモック。解析が終わると入る", example: "gemini" },
              error_message: { type: :string, nullable: true, example: nil },
              created_at: { type: :string, format: "date-time" }
            },
            required: %w[id tatami shape status scene analyzed_by error_message created_at]
          },
          CoordinationInput: {
            type: :object,
            properties: {
              coordination: {
                type: :object,
                properties: {
                  prompt: { type: :string, example: "紫色の推し活ルームにしたい" },
                  budget: { type: :integer, description: "買い足しの予算 (円)", example: 30_000 },
                  kept_object_ids: { type: :array, items: { type: :string }, description: "活かす家具の id。空なら全部活かす", example: %w[bed-1 desk-1 shelf-1] }
                },
                required: %w[prompt budget]
              }
            },
            required: %w[coordination]
          },
          CoordinationItem: {
            type: :object,
            properties: {
              marker: { type: :integer, example: 1 },
              item_id: { type: :integer, example: 101 },
              slot: { type: :string, example: "bed_cover" },
              category: { type: :string, example: "bed_cover" },
              name: { type: :string, example: "ラベンダー 布団カバー3点セット シングル" },
              price: { type: :integer, example: 4980 },
              shop: { type: :string, enum: %w[amazon rakuten], example: "rakuten" },
              url: { type: :string, example: "https://search.rakuten.co.jp/search/mall/..." },
              image_url: { type: :string, nullable: true, example: nil },
              color: { type: :string, example: "#b9a3e3" },
              placement_note: { type: :string, example: "ベッドに掛ける" }
            },
            required: %w[marker item_id slot category name price shop url image_url color placement_note]
          },
          Coordination: {
            type: :object,
            properties: {
              id: { type: :integer, example: 1 },
              room_id: { type: :integer, example: 1 },
              status: { type: :string, enum: %w[pending processing done failed], example: "done" },
              prompt: { type: :string, example: "紫色の推し活ルームにしたい" },
              budget: { type: :integer, example: 30_000 },
              kept_object_ids: { type: :array, items: { type: :string }, example: %w[bed-1 desk-1 shelf-1] },
              title: { type: :string, nullable: true, example: "ラベンダーの推し活ルーム" },
              comment: { type: :string, nullable: true, example: "ラベンダー 布団カバー3点セット シングル (ベッドに掛ける) などを追加しました。今のベッドとデスクと本棚はそのまま活かしています。" },
              before_scene: { allOf: [ { "$ref" => "#/components/schemas/Scene" } ], nullable: true },
              after_scene: { allOf: [ { "$ref" => "#/components/schemas/Scene" } ], nullable: true, description: "status が done になると入る" },
              items: { type: :array, items: { "$ref" => "#/components/schemas/CoordinationItem" }, description: "購入リンク一覧。after_scene の suggested と marker で対応する" },
              total_price: { type: :integer, nullable: true, example: 26_840 },
              planned_by: { type: :string, nullable: true, enum: [ nil, "gemini", "mock" ], description: "gemini: 要望文から AI が商品を選んだ / mock: キーワードでテーマを決めたモック。生成が終わると入る", example: "gemini" },
              error_message: { type: :string, nullable: true, example: nil },
              created_at: { type: :string, format: "date-time" }
            },
            required: %w[id room_id status prompt budget kept_object_ids title comment before_scene after_scene items total_price planned_by error_message created_at]
          }
        }
      }
    }
  }

  config.openapi_format = :yaml
end
