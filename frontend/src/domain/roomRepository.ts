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
  editedItems?: (RoomItem & { replacementFurnitureDetailId?: number })[];
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

export type FurnitureSearchInput = { query: string; color?: string; category?: string };
// 登録された家具の色・寸法・購入リンク1つ。itemはそのまま部屋へ置ける形 (furnitureDetailId付き)。
// characters: グッズになっているキャラクターのキー。credits: 表示が必要な権利表記。
export type FurnitureDetailChoice = { item: RoomItem; colorName?: string; characters: string[]; credits: ModelCredit[] };
// 家具ごとに1件。variantsは同じ家具の全detail (自身を含む)。
export type FurnitureSearchProduct = FurnitureDetailChoice & { variants: FurnitureDetailChoice[] };
// キャラクターの権利表記。フランチャイズごとに1件。
export type ModelCredit = { franchise: string; credit?: string; notice?: string; licenseUrl?: string };
// 検索語を推し活グッズとしてどう読んだか。家具検索では各一覧が空で source は none。
export type FurnitureSearchInterpretation = {
  characters: { id: string; name: string; franchise: string }[];
  franchises: { id: string; name: string }[];
  // グッズ種別 (= 家具の category)
  categories: { id: string; name: string }[];
  source: "dictionary" | "llm" | "none";
};
// 推し活グッズの3Dモデル (sizeはメートル)。
export type SearchModel = { id: string; name: string; category: string; size: { w: number; h: number; d: number }; modelUrl?: string; characters: string[]; credits: ModelCredit[] };
export type FurnitureSearchResult = { products: FurnitureSearchProduct[]; color: string | null; interpretation: FurnitureSearchInterpretation; models: SearchModel[] };

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
  searchFurniture(input: FurnitureSearchInput, signal?: AbortSignal): Promise<FurnitureSearchResult>;
  capabilities(): Promise<RoomCapabilities>;
};
