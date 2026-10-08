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
          FurnitureModelBinding: {
            type: :object,
            properties: {
              kind: { type: :string, enum: %w[existing product], example: "existing" },
              reference: { type: :string, description: "既存家具の object ID または商品の ID", example: "bed-1" }
            },
            required: %w[kind reference]
          },
          FurnitureModel: {
            type: :object,
            properties: {
              id: { type: :string, description: "安定 ID。GLB ファイル名から拡張子を除いた値", example: "bed_single" },
              name: { type: :string, example: "シングルベッド" },
              category: { type: :string, example: "bed" },
              shape: { type: :string, example: "bed_single" },
              variant: { type: :string, nullable: true, example: nil },
              format: { type: :string, enum: %w[glb], example: "glb" },
              object_key: { type: :string, description: "公開ベース URL からの相対 GCS オブジェクトパス", example: "furniture/bed_single.glb" },
              size: { "$ref" => "#/components/schemas/Size" },
              unit: { type: :string, enum: %w[meter], example: "meter" },
              axes: { type: :string, enum: [ "+Y up, +Z front, origin bottom center" ], example: "+Y up, +Z front, origin bottom center" },
              triangle_count: { type: :integer, minimum: 0, example: 1200 },
              byte_size: { type: :integer, minimum: 1, example: 48000 },
              sha256: { type: :string, pattern: "^[0-9a-f]{64}$", example: "a" * 64 },
              materials: { type: :array, items: { type: :string }, example: [ "wood", "fabric" ] },
              model_url: { type: :string, nullable: true, description: "GCS の公開 GLB URL。ベース URL が未設定なら null", example: nil },
              bindings: { type: :array, items: { "$ref" => "#/components/schemas/FurnitureModelBinding" } }
            },
            required: %w[id name category shape variant format object_key size unit axes triangle_count byte_size sha256 materials model_url bindings]
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
          Door: {
            type: :object,
            properties: {
              id: { type: :string, example: "door-1" },
              wall: { type: :string, enum: %w[north south east west], example: "west" },
              center: { type: :number, description: "壁に沿ったドアの中心位置 (north/south は x、east/west は z)", example: 3.16 },
              width: { type: :number, example: 0.8 },
              height: { type: :number, example: 2.0 },
              kind: { type: :string, enum: %w[entrance closet], description: "entrance: 部屋の出入り口 / closet: クローゼット・押し入れの扉", example: "entrance" }
            },
            required: %w[id wall center width height kind]
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
              windows: { type: :array, items: { "$ref" => "#/components/schemas/Window" } },
              doors: { type: :array, items: { "$ref" => "#/components/schemas/Door" }, description: "ドア (部屋の出入り口・クローゼットの扉)。前の床 0.8m には家具・商品を置かない。古いシーンには無い" }
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
              rotation_y: { type: :number, minimum: 0, exclusiveMaximum: true, maximum: 360, description: "度数。正面 (ローカル +z) が 0: 南, 90: 東, 180: 北, 270: 西 を向く (three.js の rotation.y と同じ)", example: 0 },
              color: { type: :string, example: "#f2f0eb" },
              ec_product_id: { type: :integer, minimum: 1, description: "リンクから補完した所有家具のEcProduct ID", example: 1 },
              price: { type: :integer, minimum: 1, description: "所有家具の参考価格。今回の購入商品合計には含めない", example: 7990 },
              shop: { type: :string, example: "IKEA" },
              url: { type: :string, example: "https://www.ikea.com/jp/ja/p/example-chair-12345678/" },
              image_url: { type: :string, nullable: true, description: "商品ページに掲載された写真URL", example: "https://www.ikea.com/jp/ja/images/products/teodores-chair-white__0727344_pe735616_s5.jpg" },
              product_metadata: { "$ref" => "#/components/schemas/ProductMetadata" },
              model_url: { type: :string, nullable: true, description: "GLB の URL。null なら category と size から箱などで代わりに描く", example: nil },
              slot: { type: :string, nullable: true, enum: [ nil, "bed_cover", "curtain", "rug", "wall_decor", "light", "display", "cushion", "desk_top", "floor" ], description: "suggested の置き場所の枠", example: nil },
              attach_to: { type: :string, nullable: true, description: "付けた先の家具・窓の id", example: nil },
              item_id: { type: :integer, nullable: true, description: "suggested の商品 id (Coordination.items と対応)", example: nil },
              marker: { type: :integer, nullable: true, description: "suggested の番号マーカー (Coordination.items と対応)", example: nil },
              replaces_object_id: { type: :string, nullable: true, example: "bed-1" },
              model_size: { "$ref" => "#/components/schemas/Size" },
              model_fit: { type: :string, enum: %w[contain], example: "contain" },
              model_match: { "$ref" => "#/components/schemas/ModelMatch" },
              texture_status: { type: :string, enum: %w[disabled ready failed skipped unmatched], example: "ready" },
              texture_source: { type: :string, enum: %w[description], example: "description" },
              material_overrides: { type: :object, additionalProperties: { "$ref" => "#/components/schemas/MaterialOverride" }, example: {} }
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
              key: { type: :string, description: "POST /api/v1/rooms の photo_keys に渡す", example: "photos/users/1/01a105cb-f338-72a2-b843-7de9d31431a1/0.jpg" },
              upload_url: { type: :string, description: "この URL へ写真を PUT する。Content-Type だけを付け、他のヘッダは足さない (署名と食い違うと 403)", example: "https://storage.googleapis.com/example-uploads/photos/users/1/01a105cb-f338-72a2-b843-7de9d31431a1/0.jpg?X-Goog-Algorithm=GOOG4-RSA-SHA256" }
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
          FurnitureEdit: {
            type: :object,
            description: "編集した家具・商品の配置。写真で見つからなかった所有家具はmanual-UUIDのidとlabel/categoryで補完する。元の解析結果は変更しない",
            properties: {
              id: { type: :string, description: "元の家具、この部屋で採用済みの商品、またはmanual-UUID形式の所有家具id", example: "bed-1" },
              label: { type: :string, maxLength: 100, description: "手動で補完した所有家具では必須", example: "今ある椅子" },
              category: { type: :string, enum: %w[sofa bed desk chair shelf table], description: "手動で補完した所有家具では必須", example: "chair" },
              ec_product_id: { type: :integer, minimum: 1, description: "商品リンクのインポート結果のID。商品・モデル情報はサーバー側で復元する", example: 1 },
              position: { "$ref" => "#/components/schemas/Position" },
              size: { "$ref" => "#/components/schemas/Size" },
              rotation_y: { type: :number, minimum: 0, exclusiveMaximum: true, maximum: 360, example: 15 },
              color: { type: :string, pattern: "^#[0-9a-fA-F]{6}$", example: "#f2f0eb" }
            },
            required: %w[id position size rotation_y color]
          },
          FurnitureOperation: {
            type: :object,
            properties: {
              object_id: { type: :string, example: "bed-1" },
              action: { type: :string, enum: %w[keep replace remove], example: "keep" }
            },
            required: %w[object_id action]
          },
          FurnitureAddition: {
            type: :object,
            properties: { category: { type: :string, enum: %w[sofa bed desk chair shelf table], example: "sofa" } },
            required: %w[category]
          },
          FurnitureImportInput: {
            type: :object,
            properties: { url: { type: :string, maxLength: 2048, description: "対応するショップの商品詳細URL", example: "https://www.ikea.com/jp/ja/p/gladom-tray-table-white-50337820/" } },
            required: %w[url]
          },
          ImportedFurniture: {
            type: :object,
            description: "実ページで確認した所有家具。寸法・色・モデルは近似で、推定した軸はproduct_metadataに記録する",
            properties: {
              ec_product_id: { type: :integer, minimum: 1, example: 1 },
              name: { type: :string, example: "ホワイトチェア" },
              category: { type: :string, enum: %w[sofa bed desk chair shelf table], example: "chair" },
              color: { type: :string, example: "#f2efe8" },
              size: { "$ref" => "#/components/schemas/Size" },
              price: { type: :integer, minimum: 1, example: 7990 },
              shop: { type: :string, example: "IKEA" },
              url: { type: :string, example: "https://www.ikea.com/jp/ja/p/example-chair-12345678/" },
              image_url: { type: :string, nullable: true, description: "商品ページのJSON-LDまたはog:imageで確認した写真URL。なければnull", example: "https://www.ikea.com/jp/ja/images/products/teodores-chair-white__0727344_pe735616_s5.jpg" },
              product_metadata: { "$ref" => "#/components/schemas/ProductMetadata" },
              model_url: { type: :string, nullable: true, example: nil },
              model_match: { allOf: [ { "$ref" => "#/components/schemas/ModelMatch" } ], nullable: true, example: nil },
              model_size: { allOf: [ { "$ref" => "#/components/schemas/Size" } ], nullable: true, example: nil },
              model_fit: { type: :string, enum: [ "contain", nil ], nullable: true, example: nil }
            },
            required: %w[ec_product_id name category color size price shop url product_metadata model_url model_match model_size model_fit]
          },
          MaterialOverride: {
            type: :object,
            properties: {
              color: { type: :string, pattern: "^#[0-9a-fA-F]{6}$", example: "#ffffff" },
              texture_url: { type: :string, example: "https://storage.googleapis.com/example-models/textures/v1/tile.png" },
              tile_size_m: { type: :number, exclusiveMinimum: true, minimum: 0, example: 0.5 }
            }
          },
          ModelMatch: {
            type: :object,
            properties: {
              model_id: { type: :integer, example: 1 },
              reason: { type: :string, example: "category_shape_ratio:desk/desk_wood" },
              approximate: { type: :boolean, example: true }
            },
            required: %w[model_id reason approximate]
          },
          ProductMetadata: {
            type: :object,
            description: "実商品・バリエーション・出典・取得日時・公式寸法と推定軸。商品写真は生成入力へ送らない",
            properties: {
              provider: { type: :string, example: "ikea" },
              provider_product_id: { type: :string, example: "50337820" },
              variant_id: { type: :string, example: "50337820" },
              currency: { type: :string, enum: %w[JPY], example: "JPY" },
              source_url: { type: :string, example: "https://www.ikea.com/jp/ja/p/gladom-tray-table-white-50337820/" },
              price_checked_at: { type: :string, format: "date-time", example: "2026-10-05T04:00:00Z" },
              fetched_at: { type: :string, format: "date-time", example: "2026-10-05T04:00:00Z" },
              availability: { type: :string, example: "unknown" },
              size: { type: :object, properties: {
                w: { type: :number, nullable: true, example: 1.3 },
                h: { type: :number, nullable: true, example: nil },
                d: { type: :number, nullable: true, example: 1.3 }
              } },
              size_source: { type: :object, additionalProperties: true, example: { "kind" => "official_page" } },
              search_entry_point_html: { type: :string, description: "Googleから返された検索候補表示HTML。隔離したiframeへ未改変で表示", example: "" },
              estimated_axes: { type: :array, items: { type: :string, enum: %w[w h d] }, example: [] },
              material: { type: :string, example: "スチール" },
              shape: { type: :string, nullable: true, example: nil },
              image_usage: { type: :object, additionalProperties: true, example: { "generation_input" => "not_used" } }
            },
            additionalProperties: true
          },
          CoordinationInput: {
            type: :object,
            properties: {
              coordination: {
                type: :object,
                properties: {
                  prompt: { type: :string, example: "紫色の推し活ルームにしたい" },
                  budget: { type: :integer, description: "追加・入れ替え商品の予算 (円・送料別)", example: 30_000 },
                  kept_object_ids: { type: :array, items: { type: :string }, description: "活かす家具の id。空なら全部活かす", example: %w[bed-1 desk-1 shelf-1] },
                  furniture_operations: { type: :array, maxItems: 100, items: { "$ref" => "#/components/schemas/FurnitureOperation" }, description: "指定時は既存家具すべてにkeep/replace/removeを一つ指定。全replace・全removeも可能。未指定・空配列は旧kept_object_idsの意味を維持", example: [] },
                  additions: { type: :array, maxItems: 6, items: { "$ref" => "#/components/schemas/FurnitureAddition" }, example: [] },
                  base_coordination_id: { type: :integer, nullable: true, description: "追加の指示 (チャット) で作り直すときの前回のコーデ (同じ部屋・生成済み)。指示に関係ない商品は前回のものを残す", example: 12 },
                  edited_objects: { type: :array, maxItems: 100, items: { "$ref" => "#/components/schemas/FurnitureEdit" }, description: "家具の最新配置と、手動で調整した商品の配置。同じ商品が再採用される場合に引き継ぐ。省略すると解析時の配置を使う", example: [] }
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
              name: { type: :string, example: "フリルチェック 掛け布団カバー シングル オレンジ×パープル" },
              price: { type: :integer, example: 12800 },
              shop: { type: :string, description: "購入先の識別子。静的な実商品参照はikeaなど、従来の検索リンクはamazonまたはrakuten", example: "francfranc" },
              url: { type: :string, description: "確認済みの商品詳細URL。未確認の参考商品では検索結果URL", example: "https://francfranc.com/products/1102030047044" },
              image_url: { type: :string, nullable: true, example: nil },
              color: { type: :string, example: "#b9a3e3" },
              placement_note: { type: :string, example: "ベッドに掛ける" },
              product_metadata: { "$ref" => "#/components/schemas/ProductMetadata" },
              texture_status: { type: :string, enum: %w[disabled ready failed skipped unmatched], example: "ready" },
              texture_source: { type: :string, enum: %w[description], example: "description" },
              model_match: { "$ref" => "#/components/schemas/ModelMatch" }
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
              furniture_operations: { type: :array, items: { "$ref" => "#/components/schemas/FurnitureOperation" }, example: [] },
              additions: { type: :array, items: { "$ref" => "#/components/schemas/FurnitureAddition" }, example: [] },
              search_entry_points: { type: :array, items: { type: :string }, description: "Google検索候補HTML。各要素を未改変で隔離表示する", example: [] },
              product_source: { type: :string, nullable: true, enum: [ nil, "ec", "mock" ], example: "ec" },
              title: { type: :string, nullable: true, example: "ラベンダーの推し活ルーム" },
              comment: { type: :string, nullable: true, example: "ラベンダー 布団カバー3点セット シングル (ベッドに掛ける) などを追加しました。今のベッドとデスクと本棚はそのまま活かしています。" },
              before_scene: { allOf: [ { "$ref" => "#/components/schemas/Scene" } ], nullable: true },
              after_scene: { allOf: [ { "$ref" => "#/components/schemas/Scene" } ], nullable: true, description: "status が done になると入る" },
              items: { type: :array, items: { "$ref" => "#/components/schemas/CoordinationItem" }, description: "購入リンク一覧。after_scene の suggested と marker で対応する" },
              total_price: { type: :integer, nullable: true, example: 26_840 },
              planned_by: { type: :string, nullable: true, enum: [ nil, "gemini", "mock" ], description: "gemini: 要望文から AI が商品を選んだ / mock: キーワードでテーマを決めたモック。生成が終わると入る", example: "gemini" },
              base_coordination_id: { type: :integer, nullable: true, description: "追加の指示で作り直したときの前回のコーデ", example: nil },
              error_message: { type: :string, nullable: true, example: nil },
              created_at: { type: :string, format: "date-time" }
            },
            required: %w[id room_id status prompt budget kept_object_ids title comment before_scene after_scene items total_price planned_by base_coordination_id error_message created_at]
          }
        }
      }
    }
  }

  config.openapi_format = :yaml
end
