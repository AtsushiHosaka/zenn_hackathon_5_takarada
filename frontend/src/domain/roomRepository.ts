import type { FurnitureAddition, FurnitureOperation, RoomDesign, RoomItem, RoomShape, Style } from "./room";

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
  furnitureOperations?: FurnitureOperation[];
  furnitureAdditions?: FurnitureAddition[];
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
