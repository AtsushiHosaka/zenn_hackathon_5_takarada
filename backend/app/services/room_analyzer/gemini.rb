require "image_processing/vips"

class RoomAnalyzer
  # 部屋の写真を Gemini で解析し、壁と床の色・窓・今ある家具を「どの壁沿いのどのあたりか」で返させる。
  # 座標や部屋の寸法は出させない (RoomLayout と畳数で決める)。
  class Gemini
    # 長辺をこの大きさまで縮めてから送る (1 リクエストの画像の合計に上限があるのと、トークンを抑えるため)
    MAX_SIDE = 1536

    WALL = { type: "string", enum: %w[north south east west] }.freeze
    POSITION = { type: "string", enum: %w[start center end] }.freeze
    COLOR = { type: "string", description: "#rrggbb 形式の色" }.freeze

    SCHEMA = {
      type: "object",
      properties: {
        wall_color: COLOR,
        floor_color: COLOR,
        windows: {
          type: "array",
          items: {
            type: "object",
            properties: { wall: WALL, position: POSITION, size: { type: "string", enum: %w[small medium large] } },
            required: %w[wall position size]
          }
        },
        furniture: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string", enum: RoomLayout::CATEGORIES },
              label: { type: "string", description: "日本語の短い名前 (例: ベッド、白い本棚)" },
              color: COLOR,
              wall: { type: "string", enum: %w[north south east west none] },
              position: POSITION,
              width_m: { type: "number", description: "壁に沿った方向の幅 (メートル)" },
              depth_m: { type: "number", description: "壁から手前への奥行き (メートル)" },
              height_m: { type: "number", description: "高さ (メートル)" }
            },
            required: %w[category label color wall position width_m depth_m height_m]
          }
        }
      },
      required: %w[wall_color floor_color windows furniture]
    }.freeze

    PROMPT = <<~TEXT.freeze
      一人暮らしの部屋を 3〜4 枚の写真で撮ったものです。写真を見て、部屋の壁と床の色、窓、今ある大きな家具を答えてください。

      方角は次のように決めます (実際の方角ではありません)。
      - 1 枚目の写真で正面に見える壁を north、その右手の壁を east、左手の壁を west、撮影者の背中側の壁を south とする。
      - 2 枚目以降の写真は、写っている家具や窓の位置関係から、1 枚目と同じ方角に当てはめる。

      position は、その壁のどのあたりにあるかです。
      - north と south の壁: west に近い端が start、中央が center、east に近い端が end。
      - east と west の壁: north に近い端が start、中央が center、south に近い端が end。

      家具について:
      - category は決められた種類から最も近いものを選ぶ。小物・家電・ラグ・カーテン・照明は含めない。
      - 壁に背を付けて置かれているものは、その壁を wall にする。部屋の中央に置かれたものは none にする。
      - width_m は壁に沿った幅、depth_m は壁から手前への奥行き、height_m は高さを、見た目からおおよそのメートルで答える。
      - 同じ家具が複数の写真に写っていても 1 つとして数える。
      - 色は写真で見える主な色を #rrggbb で答える。
      写っていないものを推測で足さないこと。
    TEXT

    def initialize(room)
      @room = room
    end

    def observe
      GeminiClient.new.generate_json(prompt: PROMPT, schema: SCHEMA, images: @room.photos.map { |photo| shrink(photo) })
    end

    private

    # 写真の向き (EXIF) を直し、長辺を MAX_SIDE までに縮めて JPEG にする
    def shrink(photo)
      photo.open do |file|
        output = ImageProcessing::Vips.source(file).resize_to_limit(MAX_SIDE, MAX_SIDE).convert("jpg").saver(quality: 85).call
        { mime_type: "image/jpeg", data: File.binread(output.path) }
      ensure
        output&.close!
      end
    end
  end
end
