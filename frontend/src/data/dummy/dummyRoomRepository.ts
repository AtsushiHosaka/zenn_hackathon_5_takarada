import { DomainError } from "../../domain/error";
import type { RoomDesign, RoomItem, Style } from "../../domain/room";
import { isRoomShape } from "../../domain/room";
import type { RoomRepository } from "../../domain/roomRepository";
import { toAnalyzedRoomDesign } from "../records/room";
import { createAnalyzedRoomFixture } from "./analyzedRoomFixture";

const palettes: Record<Style, { color: string; title: string; description: string }> = {
  botanical: { color: "#81917a", title: "緑と暮らす、やさしい部屋", description: "今あるベッドとデスクを活かし、植物と自然素材を合わせたサンプルです。" },
  oshi: { color: "#b49cf0", title: "紫の推し活ルーム", description: "今あるベッドとデスクを活かし、紫の照明と飾れる収納を合わせた推し活ルームのサンプルです。" },
  natural: { color: "#c9b899", title: "木のぬくもりで、ほっとする部屋", description: "ベージュと木目を合わせ、今ある家具がなじむ空間のサンプルです。" },
};

export function createDemoRoom(style: Style = "oshi", budget = Infinity): RoomDesign {
  const palette = palettes[style];
  const items: RoomItem[] = [
    { id: "bed", name: "今あるベッド", category: "bed", existing: true, color: "#d9c3a4", position: [-1.27968, 0.48, -0.92057], size: [1.4415, 0.96, 2.15885] },
    { id: "desk", name: "今あるデスク", category: "desk", existing: true, color: "#e8d8c0", position: [0.80007, 0.84, -1.5997], size: [1.44094, 1.68, 0.80136] },
    { id: "chair", name: "今あるデスクチェア", category: "chair", existing: true, color: "#4a4756", position: [0.75631, 0.676, -0.83372], size: [0.48852, 1.352, 0.49299] },
    { id: "1", name: "LEDテープライト 5m 調光タイプ", category: "led", existing: false, price: 2980, shop: "楽天市場（検索）", productUrl: searchLink("LEDテープライト 5m 調光"), color: style === "oshi" ? "#e2d6ff" : palette.color, position: [-0.008, 2.36358, -0.008], size: [4.00219, 0.34006, 4.00219] },
    { id: "2", name: "アクスタ用 ひな壇ディスプレイ棚 3段", category: "shelf", existing: false, price: 4280, shop: "楽天市場（検索）", productUrl: searchLink("アクスタ ひな壇 ディスプレイ棚 3段"), color: "#ffffff", position: [-1.67983, 0.796, 1.16046], size: [0.64146, 1.592, 1.20089] },
    { id: "3", name: style === "oshi" ? "ラベンダー ラウンドラグ 140cm" : "ラウンドラグ 140cm", category: "rug", existing: false, price: 6990, shop: "楽天市場（検索）", productUrl: searchLink(style === "oshi" ? "ラベンダー ラウンドラグ 140cm" : "ラウンドラグ 140cm ナチュラル"), color: style === "oshi" ? "#bba5ee" : palette.color, position: [0.47956, 0.014, 0.39988], size: [1.91911, 0.04, 1.75976] },
    { id: "4", name: "ポスターフレーム A3 2枚組", category: "artwork", existing: false, price: 3480, shop: "楽天市場（検索）", productUrl: searchLink("ポスターフレーム A3 2枚組"), color: palette.color, position: [-1.976, 1.51641, -0.92407], size: [0.04, 0.68022, 1.31867] },
    { id: "5", name: "ベルベットクッション 45×45 2個セット", category: "cushion", existing: false, price: 3290, shop: "楽天市場（検索）", productUrl: searchLink("ベルベットクッション 45 45 2個"), color: style === "oshi" ? "#7e57d9" : palette.color, position: [0.13579, 0.098, 0.57573], size: [0.95912, 0.196, 1.03994] },
    { id: "6", name: style === "oshi" ? "フロアライト パープルシェード" : "フロアライト ナチュラルシェード", category: "lamp", existing: false, price: 7980, shop: "楽天市場（検索）", productUrl: searchLink(style === "oshi" ? "フロアライト パープルシェード" : "フロアライト ナチュラル"), color: style === "oshi" ? "#cdb8ff" : "#eee5d4", position: [1.70028, 1.04, -0.85969], size: [0.27944, 2.08, 0.28175] },
    { id: "7", name: "フェイクグリーン ユーカリ 鉢付き", category: "plant", existing: false, price: 2190, shop: "楽天市場（検索）", productUrl: searchLink("フェイクグリーン ユーカリ 鉢付き"), color: "#7aa36a", position: [1.64055, 0.51, 1.52046], size: [0.32101, 1.02, 0.32101] },
    { id: "8", name: style === "oshi" ? "ベッドカバー シングル ラベンダー" : "ベッドカバー シングル ナチュラル", category: "cover", existing: false, price: 4990, shop: "楽天市場（検索）", productUrl: searchLink(style === "oshi" ? "ベッドカバー シングル ラベンダー" : "ベッドカバー シングル ナチュラル"), color: style === "oshi" ? "#9d82e3" : palette.color, position: [-1.27973, 0.504, -0.54996], size: [1.44107, 0.288, 1.45954] },
  ];
  let remaining = budget;
  return {
    id: `demo-${style}-${Number.isFinite(budget) ? budget : "all"}`,
    source: "demo",
    title: palette.title,
    description: palette.description,
    style,
    items: items.filter(item => {
      if (item.existing) return true;
      if ((item.price ?? 0) > remaining) return false;
      remaining -= item.price ?? 0;
      return true;
    }),
  };
}

function searchLink(query: string): string {
  return `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(query)}/`;
}

export function createDummyRoomRepository(): RoomRepository {
  return {
    demo: createDemoRoom,
    analyze: (input, signal) => createDummyRoomRepository().generate(input, signal),
    async capabilities() {
      return { generation: true, coordination: false, input: "dimensions", photos: false, message: "オフラインモックでは畳数と形から部屋の寸法とベッド・デスク・本棚を表示します。写真・希望・スタイルの解析と、商品生成は行いません。商品付きの提案はAPI接続で確認できます。" };
    },
    async generate(input, signal) {
      if (signal?.aborted) throw new DomainError("操作をキャンセルしました");
      if (input.tatami === undefined || !Number.isFinite(input.tatami) || input.tatami < 3 || input.tatami > 30) throw new DomainError("畳数は3〜30で入力してください");
      if (!isRoomShape(input.shape)) throw new DomainError("部屋の形を選んでください");
      const design = toAnalyzedRoomDesign(createAnalyzedRoomFixture(input.tatami, input.shape), "");
      return {
        ...design,
        items: design.items.map(item => input.editedItems?.find(edited => edited.id === item.id) ?? item),
        editedItems: input.editedItems,
        source: "demo",
        id: `demo-analysis-${input.tatami}-${input.shape}`,
        backendRoomId: undefined,
        description: "畳数と部屋の形から寸法とベッド・デスク・本棚を配置したモックです。写真・希望・スタイルの解析と、商品生成は行っていません。",
      };
    },
  };
}
