import type { FurnitureAddition, FurnitureOperation, RoomDesign, RoomItem, RoomShape, Style } from "./room";

export type RoomGenerationPhase = "uploading" | "analyzing" | "coordinating" | "preview";

export type GenerateRoomInput = {
  characterThemeId?: string;
  onProgress?: (phase: RoomGenerationPhase) => void;
  photos: File[];
  prompt: string;
  style: Style;
  roomPaletteId?: string;
  budget: number;
  tatami?: number;
  shape?: RoomShape;
  roomId?: string;
  keptObjectIds?: string[];
  editedItems?: RoomItem[];
  furnitureOperations?: FurnitureOperation[];
  furnitureAdditions?: FurnitureAddition[];
  // 追加の指示 (チャット) で作り直すときの前回のコーデ (backend の ID)。指示に関係ない商品は前回のものが残る
  baseCoordinationId?: string;
};

// photos: 部屋の写真を受け取れるか (dummyは受け取らない)。
// input: 寸法を入力させるか、写真だけで解析するか。
export type RoomCapabilities = { generation: boolean; coordination: boolean; message: string; input: "dimensions" | "photos"; photos: boolean };

export type SavedRoom = {
  id: string;
  title: string;
  createdAt: string;
  status: "analyzing" | "ready" | "failed";
  design?: RoomDesign;
  errorMessage?: string;
};

export type RoomRepository = {
  demo(style?: Style): RoomDesign;
  // Non-fatal persistence status for the current owner, when supported.
  persistenceWarning?(): string | undefined;
  list(signal?: AbortSignal): Promise<SavedRoom[]>;
  // 一覧のIDまたはRoomDesign.idから、保存された部屋を復元する。
  get(id: string, signal?: AbortSignal): Promise<RoomDesign>;
  createFromTemplate(template: RoomDesign, signal?: AbortSignal): Promise<RoomDesign>;
  analyze(input: GenerateRoomInput, signal?: AbortSignal): Promise<RoomDesign>;
  generate(input: GenerateRoomInput, signal?: AbortSignal): Promise<RoomDesign>;
  importFurniture(url: string, signal?: AbortSignal): Promise<RoomItem>;
  capabilities(): Promise<RoomCapabilities>;
};
