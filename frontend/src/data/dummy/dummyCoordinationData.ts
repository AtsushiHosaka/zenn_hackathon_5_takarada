// ダミー接続で返すサンプル。実 API (6 畳・やや縦長・「紫色の推し活ルームにしたい」・予算 3 万円) の
// レスポンスをそのまま写したもの。ダミーでは入力にかかわらず、この部屋とコーデを返す。
import type { CoordinationRecord } from "../records/coordination";
import type { SceneRecord } from "../records/scene";

export const sampleRoomScene: SceneRecord = {
  "room": {
    "depth": 3.6,
    "width": 2.7,
    "height": 2.4,
    "windows": [
      {
        "id": "window-1",
        "wall": "south",
        "width": 1.2,
        "bottom": 0.9,
        "center": 1.35,
        "height": 1.1
      }
    ],
    "wall_color": "#f4f1ec",
    "floor_color": "#c8a97e"
  },
  "objects": [
    {
      "id": "bed-1",
      "size": {
        "d": 1.95,
        "h": 0.45,
        "w": 0.97
      },
      "slot": null,
      "color": "#f2f0eb",
      "label": "ベッド",
      "marker": null,
      "source": "existing",
      "item_id": null,
      "category": "bed",
      "position": {
        "x": 0.51,
        "y": 0.0,
        "z": 1.0
      },
      "attach_to": null,
      "model_url": null,
      "rotation_y": 0
    },
    {
      "id": "desk-1",
      "size": {
        "d": 0.5,
        "h": 0.72,
        "w": 1.0
      },
      "slot": null,
      "color": "#a0784f",
      "label": "デスク",
      "marker": null,
      "source": "existing",
      "item_id": null,
      "category": "desk",
      "position": {
        "x": 2.18,
        "y": 0.0,
        "z": 0.27
      },
      "attach_to": null,
      "model_url": null,
      "rotation_y": 0
    },
    {
      "id": "shelf-1",
      "size": {
        "d": 0.3,
        "h": 1.8,
        "w": 0.8
      },
      "slot": null,
      "color": "#8b6a4a",
      "label": "本棚",
      "marker": null,
      "source": "existing",
      "item_id": null,
      "category": "shelf",
      "position": {
        "x": 2.53,
        "y": 0.0,
        "z": 2.16
      },
      "attach_to": null,
      "model_url": null,
      "rotation_y": 270
    }
  ]
};

export const sampleCoordination: Pick<CoordinationRecord, "title" | "comment" | "after_scene" | "items" | "total_price"> = {
  title: "ラベンダーの推し活ルーム",
  comment: "ラベンダー 布団カバー3点セット シングル (ベッドに掛ける)、パープル 遮光カーテン 2枚組 (窓)、ラベンダー シャギーラグ 140×200 (部屋の中央) などを追加しました。今のベッドとデスクと本棚はそのまま活かしています。",
  after_scene: {
  "room": {
    "depth": 3.6,
    "width": 2.7,
    "height": 2.4,
    "windows": [
      {
        "id": "window-1",
        "wall": "south",
        "width": 1.2,
        "bottom": 0.9,
        "center": 1.35,
        "height": 1.1
      }
    ],
    "wall_color": "#f4f1ec",
    "floor_color": "#c8a97e"
  },
  "objects": [
    {
      "id": "bed-1",
      "size": {
        "d": 1.95,
        "h": 0.45,
        "w": 0.97
      },
      "slot": null,
      "color": "#f2f0eb",
      "label": "ベッド",
      "marker": null,
      "source": "existing",
      "item_id": null,
      "category": "bed",
      "position": {
        "x": 0.51,
        "y": 0.0,
        "z": 1.0
      },
      "attach_to": null,
      "model_url": null,
      "rotation_y": 0
    },
    {
      "id": "desk-1",
      "size": {
        "d": 0.5,
        "h": 0.72,
        "w": 1.0
      },
      "slot": null,
      "color": "#a0784f",
      "label": "デスク",
      "marker": null,
      "source": "existing",
      "item_id": null,
      "category": "desk",
      "position": {
        "x": 2.18,
        "y": 0.0,
        "z": 0.27
      },
      "attach_to": null,
      "model_url": null,
      "rotation_y": 0
    },
    {
      "id": "shelf-1",
      "size": {
        "d": 0.3,
        "h": 1.8,
        "w": 0.8
      },
      "slot": null,
      "color": "#8b6a4a",
      "label": "本棚",
      "marker": null,
      "source": "existing",
      "item_id": null,
      "category": "shelf",
      "position": {
        "x": 2.53,
        "y": 0.0,
        "z": 2.16
      },
      "attach_to": null,
      "model_url": null,
      "rotation_y": 270
    },
    {
      "id": "item-101",
      "size": {
        "d": 1.99,
        "h": 0.06,
        "w": 1.05
      },
      "slot": "bed_cover",
      "color": "#b9a3e3",
      "label": "ラベンダー 布団カバー3点セット シングル",
      "marker": 1,
      "source": "suggested",
      "item_id": 101,
      "category": "bed_cover",
      "position": {
        "x": 0.525,
        "y": 0.43,
        "z": 1.0
      },
      "attach_to": "bed-1",
      "model_url": null,
      "rotation_y": 0
    },
    {
      "id": "item-102",
      "size": {
        "d": 0.04,
        "h": 2.15,
        "w": 1.6
      },
      "slot": "curtain",
      "color": "#8e6cc8",
      "label": "パープル 遮光カーテン 2枚組",
      "marker": 2,
      "source": "suggested",
      "item_id": 102,
      "category": "curtain",
      "position": {
        "x": 1.35,
        "y": 0.0,
        "z": 3.53
      },
      "attach_to": "window-1",
      "model_url": null,
      "rotation_y": 180
    },
    {
      "id": "item-103",
      "size": {
        "d": 2.0,
        "h": 0.03,
        "w": 1.4
      },
      "slot": "rug",
      "color": "#c9b6e4",
      "label": "ラベンダー シャギーラグ 140×200",
      "marker": 3,
      "source": "suggested",
      "item_id": 103,
      "category": "rug",
      "position": {
        "x": 1.32,
        "y": 0.0,
        "z": 2.72
      },
      "attach_to": null,
      "model_url": null,
      "rotation_y": 90
    },
    {
      "id": "item-104",
      "size": {
        "d": 0.12,
        "h": 0.5,
        "w": 0.6
      },
      "slot": "wall_decor",
      "color": "#ffffff",
      "label": "推し活 ウォールシェルフ 3段 (祭壇用)",
      "marker": 4,
      "source": "suggested",
      "item_id": 104,
      "category": "wall_shelf",
      "position": {
        "x": 2.2,
        "y": 1.02,
        "z": 0.07
      },
      "attach_to": "desk-1",
      "model_url": null,
      "rotation_y": 0
    },
    {
      "id": "item-112",
      "size": {
        "d": 0.2,
        "h": 1.2,
        "w": 0.2
      },
      "slot": "light",
      "color": "#9b7ad6",
      "label": "LED スタンドライト スリム (パープル)",
      "marker": 5,
      "source": "suggested",
      "item_id": 112,
      "category": "floor_lamp",
      "position": {
        "x": 0.12,
        "y": 0.0,
        "z": 3.47
      },
      "attach_to": null,
      "model_url": null,
      "rotation_y": 0
    },
    {
      "id": "item-113",
      "size": {
        "d": 0.25,
        "h": 0.9,
        "w": 0.35
      },
      "slot": "display",
      "color": "#e6def5",
      "label": "アクリル コレクションラック 3段",
      "marker": 6,
      "source": "suggested",
      "item_id": 113,
      "category": "display_case",
      "position": {
        "x": 2.545,
        "y": 0.0,
        "z": 1.545
      },
      "attach_to": "shelf-1",
      "model_url": null,
      "rotation_y": 270
    },
    {
      "id": "item-107",
      "size": {
        "d": 0.45,
        "h": 0.15,
        "w": 0.45
      },
      "slot": "cushion",
      "color": "#7b4fc4",
      "label": "推しカラー クッション 2個セット",
      "marker": 7,
      "source": "suggested",
      "item_id": 107,
      "category": "cushion",
      "position": {
        "x": 0.51,
        "y": 0.49,
        "z": 0.325
      },
      "attach_to": "bed-1",
      "model_url": null,
      "rotation_y": 0
    },
    {
      "id": "item-108",
      "size": {
        "d": 0.15,
        "h": 0.15,
        "w": 0.3
      },
      "slot": "desk_top",
      "color": "#e8e0f5",
      "label": "アクスタ 収納ケース ひな壇",
      "marker": 8,
      "source": "suggested",
      "item_id": 108,
      "category": "acrylic_stand_case",
      "position": {
        "x": 2.45,
        "y": 0.72,
        "z": 0.145
      },
      "attach_to": "desk-1",
      "model_url": null,
      "rotation_y": 0
    }
  ]
},
  items: [
  {
    "url": "https://search.rakuten.co.jp/search/mall/%E3%83%A9%E3%83%99%E3%83%B3%E3%83%80%E3%83%BC%20%E5%B8%83%E5%9B%A3%E3%82%AB%E3%83%90%E3%83%BC%20%E3%82%B7%E3%83%B3%E3%82%B0%E3%83%AB/",
    "name": "ラベンダー 布団カバー3点セット シングル",
    "shop": "rakuten",
    "slot": "bed_cover",
    "color": "#b9a3e3",
    "price": 4980,
    "marker": 1,
    "item_id": 101,
    "category": "bed_cover",
    "image_url": null,
    "placement_note": "ベッドに掛ける"
  },
  {
    "url": "https://www.amazon.co.jp/s?k=%E3%83%91%E3%83%BC%E3%83%97%E3%83%AB%20%E9%81%AE%E5%85%89%E3%82%AB%E3%83%BC%E3%83%86%E3%83%B3",
    "name": "パープル 遮光カーテン 2枚組",
    "shop": "amazon",
    "slot": "curtain",
    "color": "#8e6cc8",
    "price": 3980,
    "marker": 2,
    "item_id": 102,
    "category": "curtain",
    "image_url": null,
    "placement_note": "窓"
  },
  {
    "url": "https://search.rakuten.co.jp/search/mall/%E3%83%A9%E3%83%99%E3%83%B3%E3%83%80%E3%83%BC%20%E3%82%B7%E3%83%A3%E3%82%AE%E3%83%BC%E3%83%A9%E3%82%B0%20140%C3%97200/",
    "name": "ラベンダー シャギーラグ 140×200",
    "shop": "rakuten",
    "slot": "rug",
    "color": "#c9b6e4",
    "price": 5980,
    "marker": 3,
    "item_id": 103,
    "category": "rug",
    "image_url": null,
    "placement_note": "部屋の中央"
  },
  {
    "url": "https://www.amazon.co.jp/s?k=%E6%8E%A8%E3%81%97%E6%B4%BB%20%E3%82%A6%E3%82%A9%E3%83%BC%E3%83%AB%E3%82%B7%E3%82%A7%E3%83%AB%E3%83%95%20%E7%A5%AD%E5%A3%87",
    "name": "推し活 ウォールシェルフ 3段 (祭壇用)",
    "shop": "amazon",
    "slot": "wall_decor",
    "color": "#ffffff",
    "price": 2980,
    "marker": 4,
    "item_id": 104,
    "category": "wall_shelf",
    "image_url": null,
    "placement_note": "デスクの上の壁"
  },
  {
    "url": "https://search.rakuten.co.jp/search/mall/LED%20%E3%82%B9%E3%82%BF%E3%83%B3%E3%83%89%E3%83%A9%E3%82%A4%E3%83%88%20%E3%82%B9%E3%83%AA%E3%83%A0%20RGB/",
    "name": "LED スタンドライト スリム (パープル)",
    "shop": "rakuten",
    "slot": "light",
    "color": "#9b7ad6",
    "price": 3480,
    "marker": 5,
    "item_id": 112,
    "category": "floor_lamp",
    "image_url": null,
    "placement_note": "部屋の角"
  },
  {
    "url": "https://www.amazon.co.jp/s?k=%E3%82%A2%E3%82%AF%E3%83%AA%E3%83%AB%20%E3%82%B3%E3%83%AC%E3%82%AF%E3%82%B7%E3%83%A7%E3%83%B3%E3%83%A9%E3%83%83%E3%82%AF%203%E6%AE%B5",
    "name": "アクリル コレクションラック 3段",
    "shop": "amazon",
    "slot": "display",
    "color": "#e6def5",
    "price": 3980,
    "marker": 6,
    "item_id": 113,
    "category": "display_case",
    "image_url": null,
    "placement_note": "本棚の横"
  },
  {
    "url": "https://www.amazon.co.jp/s?k=%E6%8E%A8%E3%81%97%E3%82%AB%E3%83%A9%E3%83%BC%20%E3%82%AF%E3%83%83%E3%82%B7%E3%83%A7%E3%83%B3%20%E7%B4%AB",
    "name": "推しカラー クッション 2個セット",
    "shop": "amazon",
    "slot": "cushion",
    "color": "#7b4fc4",
    "price": 1980,
    "marker": 7,
    "item_id": 107,
    "category": "cushion",
    "image_url": null,
    "placement_note": "ベッドの枕元"
  },
  {
    "url": "https://www.amazon.co.jp/s?k=%E3%82%A2%E3%82%AF%E3%82%B9%E3%82%BF%20%E3%81%B2%E3%81%AA%E5%A3%87%20%E3%82%B1%E3%83%BC%E3%82%B9",
    "name": "アクスタ 収納ケース ひな壇",
    "shop": "amazon",
    "slot": "desk_top",
    "color": "#e8e0f5",
    "price": 1480,
    "marker": 8,
    "item_id": 108,
    "category": "acrylic_stand_case",
    "image_url": null,
    "placement_note": "デスクの上"
  }
],
  total_price: 28840,
};
