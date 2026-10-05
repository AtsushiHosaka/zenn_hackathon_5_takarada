import type { RoomDesign, RoomItem, RoomShape, Style } from "./room";

export type GenerateRoomInput = {
  photos: File[];
  prompt: string;
  style: Style;
  budget: number;
  tatami?: number;
  shape?: RoomShape;
  roomId?: string;
  keptObjectIds?: string[];
  editedItems?: RoomItem[];
  // 追加の指示 (チャット) で作り直すときの前回のコーデ (backend の ID)。指示に関係ない商品は前回のものが残る
  baseCoordinationId?: string;
};

// photos: 部屋の写真を受け取れるか (dummyは受け取らない)。
// input: 寸法を入力させるか、写真だけで解析するか。
export type RoomCapabilities = { generation: boolean; coordination: boolean; message: string; input: "dimensions" | "photos"; photos: boolean };

export type RoomRepository = {
  demo(style?: Style): RoomDesign;
  analyze(input: GenerateRoomInput, signal?: AbortSignal): Promise<RoomDesign>;
  generate(input: GenerateRoomInput, signal?: AbortSignal): Promise<RoomDesign>;
  capabilities(): Promise<RoomCapabilities>;
};
