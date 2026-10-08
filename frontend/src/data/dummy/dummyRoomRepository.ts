import { DomainError } from "../../domain/error";
import type { TokenStore } from "../../core/tokenStore";
import type { RoomDesign, RoomItem, Style } from "../../domain/room";
import { isRoomDesign, isRoomShape } from "../../domain/room";
import type { RoomRepository, SavedRoom } from "../../domain/roomRepository";
import { toAnalyzedRoomDesign } from "../records/room";
import { demoProductReference } from "./demoProductReferences";
import { createAnalyzedRoomFixture } from "./analyzedRoomFixture";
import { dummyDatabase, tick } from "./dummyDatabase";

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
    { id: "1", category: "led", existing: false, color: style === "oshi" ? "#e2d6ff" : palette.color, position: [-0.008, 2.36358, -0.008], size: [4.00219, 0.34006, 4.00219], ...demoProductReference("1", style) },
    { id: "2", category: "shelf", existing: false, color: "#ffffff", position: [-1.67983, 0.796, 1.16046], size: [0.64146, 1.592, 1.20089], ...demoProductReference("2", style) },
    { id: "3", category: "rug", existing: false, color: style === "oshi" ? "#bba5ee" : palette.color, position: [0.47956, 0.014, 0.39988], size: [1.91911, 0.04, 1.75976], ...demoProductReference("3", style) },
    { id: "4", category: "artwork", existing: false, color: palette.color, position: [-1.976, 1.51641, -0.92407], size: [0.04, 0.68022, 1.31867], ...demoProductReference("4", style) },
    { id: "5", category: "cushion", existing: false, color: style === "oshi" ? "#7e57d9" : palette.color, position: [0.13579, 0.098, 0.57573], size: [0.95912, 0.196, 1.03994], ...demoProductReference("5", style) },
    { id: "6", category: "lamp", existing: false, color: style === "oshi" ? "#cdb8ff" : "#eee5d4", position: [1.70028, 1.04, -0.85969], size: [0.27944, 2.08, 0.28175], ...demoProductReference("6", style) },
    { id: "7", category: "plant", existing: false, color: "#7aa36a", position: [1.64055, 0.51, 1.52046], size: [0.32101, 1.02, 0.32101], ...demoProductReference("7", style) },
    { id: "8", category: "cover", existing: false, color: style === "oshi" ? "#9d82e3" : palette.color, position: [-1.27973, 0.504, -0.54996], size: [1.44107, 0.288, 1.45954], ...demoProductReference("8", style) },
  ];
  let remaining = budget;
  return {
    id: `demo-${style}-${Number.isFinite(budget) ? budget : "all"}`,
    source: "demo",
    title: palette.title,
    description: `${palette.description} 商品情報は2026年10月5日時点の参考値です。3Dの形・色・寸法・数量は近似で、商品の再現ではありません。`,
    style,
    items: items.filter(item => {
      if (item.existing) return true;
      if ((item.price ?? 0) > remaining) return false;
      remaining -= item.price ?? 0;
      return true;
    }),
  };
}

function storedRooms(userId: number): SavedRoom[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(`hack.dummy.rooms.v1.${userId}`) ?? "[]");
    if (!Array.isArray(saved) || !saved.every((room: unknown) => {
      if (typeof room !== "object" || room === null) return false;
      const record = room as Record<string, unknown>;
      return typeof record.id === "string" && typeof record.title === "string"
        && typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt))
        && record.status === "ready" && isRoomDesign(record.design) && record.id === record.design.id;
    })) throw new Error("Invalid saved rooms");
    return saved as SavedRoom[];
  } catch {
    throw new DomainError("保存した部屋を読み込めません。ブラウザの保存設定を確認してください");
  }
}

export function createDummyRoomRepository(tokenStore: TokenStore): RoomRepository {
  const currentUserId = () => dummyDatabase.userOf(tokenStore.load()).id;
  return {
    demo: createDemoRoom,
    async list(signal) {
      await tick();
      if (signal?.aborted) throw new DomainError("操作をキャンセルしました");
      return storedRooms(currentUserId());
    },
    async get(roomId, signal) {
      await tick();
      if (signal?.aborted) throw new DomainError("操作をキャンセルしました");
      const room = storedRooms(currentUserId()).find(room => room.id === roomId);
      if (!room?.design) throw new DomainError("部屋が見つかりません", 404);
      return room.design;
    },
    analyze: (input, signal) => createDummyRoomRepository(tokenStore).generate(input, signal),
    async capabilities() {
      return { generation: true, coordination: false, input: "dimensions", photos: false, message: "オフラインモックでは畳数と形から部屋の寸法とベッド・デスク・本棚を表示します。写真・希望・スタイルの解析と、商品生成は行いません。商品付きの提案はAPI接続で確認できます。" };
    },
    async generate(input, signal) {
      const userId = currentUserId();
      if (signal?.aborted) throw new DomainError("操作をキャンセルしました");
      if (input.tatami === undefined || !Number.isFinite(input.tatami) || input.tatami < 3 || input.tatami > 30) throw new DomainError("畳数は3〜30で入力してください");
      if (!isRoomShape(input.shape)) throw new DomainError("部屋の形を選んでください");
      const rooms = storedRooms(userId);
      const previous = input.roomId === undefined ? undefined : rooms.find(room => room.id === input.roomId);
      if (input.roomId !== undefined && !previous) throw new DomainError("部屋が見つかりません", 404);
      const analyzed = toAnalyzedRoomDesign(createAnalyzedRoomFixture(input.tatami, input.shape), "");
      const design: RoomDesign = {
        ...analyzed,
        items: analyzed.items.map(item => input.editedItems?.find(edited => edited.id === item.id) ?? item),
        editedItems: input.editedItems,
        source: "demo",
        id: previous?.id ?? `dummy-room-${crypto.randomUUID()}`,
        backendRoomId: undefined,
        style: input.style,
        prompt: input.prompt.trim() || undefined,
        budget: input.budget,
        description: "畳数と部屋の形から寸法とベッド・デスク・本棚を配置したモックです。写真・希望・スタイルの解析と、商品生成は行っていません。",
      };
      if (!isRoomDesign(design)) throw new DomainError("部屋の入力内容を確認してください", 422);
      const room: SavedRoom = { id: design.id, title: design.title, status: "ready", createdAt: previous?.createdAt ?? new Date().toISOString(), design };
      try {
        localStorage.setItem(`hack.dummy.rooms.v1.${userId}`, JSON.stringify([room, ...rooms.filter(saved => saved.id !== room.id)]));
      } catch {
        throw new DomainError("部屋を保存できません。ブラウザの保存設定を確認してください");
      }
      return design;
    },
  };
}
