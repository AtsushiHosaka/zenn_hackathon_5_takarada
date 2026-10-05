import type { RoomItem, Style } from "../../domain/room";

// 2026-10-05時点の静的な実商品参照。出典・数量・3Dの制約はSpec参照。
type ProductReference = Pick<RoomItem, "name" | "price" | "shop" | "productUrl"> & Partial<Pick<RoomItem, "color">>;

const common: Record<string, ProductReference> = {
  "1": {
    "name": "ORMANÄS オルマネス LEDテープライト 4m",
    "price": 4999,
    "shop": "IKEA",
    "productUrl": "https://www.ikea.com/jp/ja/p/ormanaes-led-lighting-strip-smart-wireless-dimmable-colour-and-white-spectrum-30541327/"
  },
  "2": {
    "name": "KALLAX カラックス シェルフユニット ホワイト 42×147cm",
    "price": 7999,
    "shop": "IKEA",
    "productUrl": "https://www.ikea.com/jp/ja/p/kallax-shelving-unit-white-40351883/",
    "color": "#ffffff"
  },
  "3": {
    "name": "STOENSE ストエンセ 円形ラグ パイル短 オフホワイト 直径130cm",
    "price": 9990,
    "color": "#ece6db",
    "shop": "IKEA",
    "productUrl": "https://www.ikea.com/jp/ja/p/stoense-rug-low-pile-off-white-80426805/"
  },
  "4": {
    "name": "FISKBO フィスクボー フレーム ホワイト 30×40cm（2個分）",
    "price": 998,
    "shop": "IKEA",
    "productUrl": "https://www.ikea.com/jp/ja/p/fiskbo-frame-white-90300462/",
    "color": "#ffffff"
  },
  "5": {
    "name": "PROFETBLOMMA プロフェットブロマ クッション ライトベージュ 50×50cm",
    "price": 499,
    "color": "#e7dcc8",
    "shop": "IKEA",
    "productUrl": "https://www.ikea.com/jp/ja/p/profetblomma-cushion-light-beige-70614208/"
  },
  "6": {
    "name": "ÅRSTID オースティード フロアランプ ニッケルメッキ／ホワイト",
    "price": 9990,
    "color": "#f4f0e9",
    "shop": "IKEA",
    "productUrl": "https://www.ikea.com/jp/ja/p/arstid-floor-lamp-nickel-plated-white-70163866/"
  },
  "7": {
    "name": "FEJKA フェイカ 人工観葉植物 室内/屋外用 ユーカリ 19cm",
    "price": 5990,
    "color": "#7d9c7a",
    "shop": "IKEA",
    "productUrl": "https://www.ikea.com/jp/ja/p/fejka-artificial-potted-plant-in-outdoor-eucalyptus-90600875/"
  },
  "8": {
    "name": "ÄNGSLILJA エングスリリア 掛け布団カバー＆枕カバー ナチュラル 150×200cm",
    "price": 2999,
    "color": "#efe6d8",
    "shop": "IKEA",
    "productUrl": "https://www.ikea.com/jp/ja/p/aengslilja-duvet-cover-and-pillowcase-natural-40591982/"
  }
};

const byStyle: Record<Style, Record<string, ProductReference>> = {
  "oshi": {
    "5": {
      "name": "ポップコーンワッフル フロアクッション φ60 ライトパープル",
      "price": 3480,
      "color": "#cbb8e6",
      "shop": "Francfranc",
      "productUrl": "https://francfranc.com/products/1102130131612"
    },
    "6": {
      "name": "カールトン フロアランプ ブラック",
      "price": 14000,
      "color": "#222222",
      "shop": "Francfranc",
      "productUrl": "https://francfranc.com/products/1109040028100"
    },
    "8": {
      "name": "フリルチェック 掛け布団カバー シングル オレンジ×パープル",
      "price": 12800,
      "color": "#b9a3e3",
      "shop": "Francfranc",
      "productUrl": "https://francfranc.com/products/1102030047044"
    }
  },
  "botanical": {
    "3": {
      "name": "STOENSE ストエンセ ラグ パイル短 ミディアムグレー 130cm",
      "price": 9990,
      "color": "#aaaaa6",
      "shop": "IKEA",
      "productUrl": "https://www.ikea.com/jp/ja/p/stoense-rug-low-pile-medium-grey-60426830/"
    },
    "5": {
      "name": "HALLONBUSKE ハロンブスケ クッションカバー グリーン/フローラルパターン 48×48cm",
      "price": 2499,
      "color": "#7c9a6a",
      "shop": "IKEA",
      "productUrl": "https://www.ikea.com/jp/ja/p/hallonbuske-cushion-cover-green-floral-pattern-60636734/"
    },
    "6": {
      "name": "LAUTERS ラウテルス フロアランプ アッシュ/ホワイト",
      "price": 10990,
      "color": "#b08960",
      "shop": "IKEA",
      "productUrl": "https://www.ikea.com/jp/ja/p/lauters-floor-lamp-ash-white-00405053/"
    },
    "8": {
      "name": "ÄNGSLILJA エングスリリア 掛け布団カバー＆枕カバー ペールグレーグリーン 150×200/50×60cm",
      "price": 2999,
      "color": "#9cae8c",
      "shop": "IKEA",
      "productUrl": "https://www.ikea.com/jp/ja/p/aengslilja-duvet-cover-and-pillowcase-pale-grey-green-20632455/"
    }
  },
  "natural": {}
};

export function demoProductReference(id: string, style: Style): ProductReference {
  return byStyle[style][id] ?? common[id];
}
