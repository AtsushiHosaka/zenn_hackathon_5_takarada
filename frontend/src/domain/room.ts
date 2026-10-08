import { roomPalette } from "./roomPalette";

import { characterTheme } from "./characterTheme";
export type Style = "botanical" | "oshi" | "natural";
export type RoomShape = "square" | "standard" | "long";
export const furnitureCategories = ["sofa", "bed", "desk", "chair", "shelf", "table"] as const;
export const replacementFurnitureCategories = [...furnitureCategories, "storage", "tv_stand", "wardrobe"] as const;
export const productCategories = [...replacementFurnitureCategories, "bed_cover", "curtain", "rug", "cushion", "floor_lamp", "desk_lamp", "plant", "small_plant", "wall_art", "wall_mirror", "wall_planter", "wall_shelf", "display_case", "acrylic_stand_case", "oshi_goods", "tapestry", "neon", "vase", "candle"] as const;
export type ProductCategory = typeof productCategories[number];
export type FurnitureCategory = typeof furnitureCategories[number];
export type FurnitureOperation = { objectId: string; action: "keep" | "replace" | "remove" };
export type FurnitureAddition = { category: FurnitureCategory };
export type TextureStatus = "disabled" | "ready" | "failed" | "skipped" | "unmatched";
export type MaterialOverrides = Record<string, { textureUrl?: string; tileSizeM?: number; color?: string }>;
export type ProductColorVariant = { colorName: string; url: string; variantId?: string; source: "official_color_picker" | "official_product_group" };
export type ProductMetadata = {
  provider?: string;
  providerProductId?: string;
  variantId?: string;
  officialColor?: string;
  colorVariants?: ProductColorVariant[];
  sourceUrl?: string;
  priceCheckedAt?: string;
  sizeSource?: string | { url?: string; evidence?: string | string[]; kind?: string };
  estimatedAxes?: ("w" | "h" | "d")[];
  material?: string;
  shape?: string;
  availability?: string;
  size?: { w: number | null; h: number | null; d: number | null };
  imageDisplayAllowed?: boolean;
  searchEntryPointHtml?: string;
};
export type RoomWindow = {
  id: string;
  wall: "north" | "east" | "south" | "west";
  center: number;
  width: number;
  bottom: number;
  height: number;
};
export type RoomGeometry = {
  width: number;
  depth: number;
  height: number;
  floorColor: string;
  windows: RoomWindow[];
};

export const imageGoodsCategories = ["poster", "acrylic_stand"] as const;
export type ImageGoodsCategory = typeof imageGoodsCategories[number];
export type ImageArtwork = { dataUrl: string };
export const MAX_ARTWORK_DATA_LENGTH = 262144;

export function isImageArtwork(value: unknown): value is ImageArtwork {
  return isRecord(value) && typeof value.dataUrl === "string" && value.dataUrl.length <= MAX_ARTWORK_DATA_LENGTH && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value.dataUrl);
}

export type RoomItem = {
  // Browser-local source photo; category models provide its editable 3D representation.
  referenceImage?: ImageArtwork;
  artwork?: ImageArtwork;
  id: string;
  name: string;
  category: string;
  existing: boolean;
  price?: number;
  shop?: string;
  productUrl?: string;
  imageUrl?: string;
  color: string;
  // 単位はメートル。Yが高さ、positionはオブジェクトの中心。
  position: [number, number, number];
  size: [number, number, number];
  // Y軸まわりの回転角度。単位は度、0以上360未満。
  rotation?: number;
  modelUrl?: string;
  // APIのitem_id。画面内のidやmarkerから商品IDを推定しない。
  productId?: string;
  // 商品リンクから取得したEC商品のID。再提案時も取得元を引き継ぐ。
  ecProductId?: string;
  marker?: number;
  materialOverrides?: MaterialOverrides;
  textureStatus?: TextureStatus;
  textureSource?: "description";
  modelMatch?: { modelId: string; reason: string; approximate: boolean };
  modelSize?: { w: number; h: number; d: number };
  modelFit?: "contain";
  replacesObjectId?: string;
  productMetadata?: ProductMetadata;
};

export function isManualFurniture(item: RoomItem): boolean {
  return item.existing && /^manual-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
}

// Template objects belong to a copied base scene, so they must not be appended as manual input.
export function isTemplateFurniture(item: RoomItem): boolean {
  return item.existing && /^template-object-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
}

export type RoomSnapshot = { room: RoomGeometry; items: RoomItem[]; wallColor?: string };

export type RoomDesign = {
  characterThemeId?: string;
  kind?: "analysis" | "coordination";
  source: "demo" | "api";
  id: string;
  title: string;
  description: string;
  style: Style;
  roomPaletteId?: string;
  items: RoomItem[];
  modelUrl?: string;
  // modelUrlがある場合、未指定なら家具を含む完成モデルとして扱う。
  modelKind?: "complete" | "shell";
  wallColor?: string;
  room?: RoomGeometry;
  // Stable floor inferred for legacy designs without measured room geometry.
  inferredRoomBounds?: { min: [number, number, number]; max: [number, number, number]; floor: number };
  analysisInput?: { tatami: number; shape: RoomShape };
  before?: RoomSnapshot;
  backendRoomId?: string;
  prompt?: string;
  budget?: number;
  keptObjectIds?: string[];
  furnitureOperations?: FurnitureOperation[];
  furnitureAdditions?: FurnitureAddition[];
  productSource?: "ec" | "mock";
  searchEntryPoints?: string[];
  // 手動で編集した家具。選択から外した既存家具の変更も次の提案まで保持する。
  editedItems?: RoomItem[];
  // API の結果を AI (Gemini) が作ったか。部屋の解析は analyzed_by、コーデは planned_by から入る。
  // 古い保存データや古い API には無いので、無ければ従来どおりモックとして表示する
  generatedBy?: "gemini" | "mock";
};

// ブラウザに保存されたデータも、復元時には信頼しない。
export function isRoomDesign(value: unknown): value is RoomDesign {
  if (!isRecord(value)) return false;
  if (value.characterThemeId !== undefined && !characterTheme(value.characterThemeId)) return false;
  if (value.source !== "demo" && value.source !== "api") return false;
  if (value.kind !== undefined && value.kind !== "analysis" && value.kind !== "coordination") return false;
  if (value.style !== "botanical" && value.style !== "oshi" && value.style !== "natural") return false;
  if (!nonemptyString(value.id) || !nonemptyString(value.title) || !nonemptyString(value.description)) return false;
  if (value.roomPaletteId !== undefined && !roomPalette(value.roomPaletteId)) return false;
  if (value.modelKind !== undefined && value.modelKind !== "complete" && value.modelKind !== "shell") return false;
  if (value.wallColor !== undefined && (typeof value.wallColor !== "string" || !/^#[0-9a-f]{6}$/i.test(value.wallColor))) return false;
  if (value.room !== undefined && !isRoomGeometry(value.room)) return false;
  if (value.inferredRoomBounds !== undefined && !isInferredRoomBounds(value.inferredRoomBounds)) return false;
  if (value.analysisInput !== undefined && (!isRecord(value.analysisInput) || !isTatami(value.analysisInput.tatami) || !isRoomShape(value.analysisInput.shape))) return false;
  if (value.backendRoomId !== undefined && (typeof value.backendRoomId !== "string" || !/^[1-9]\d*$/.test(value.backendRoomId))) return false;
  if (value.prompt !== undefined && (!nonemptyString(value.prompt) || value.prompt.length > 500)) return false;
  if (value.budget !== undefined && (typeof value.budget !== "number" || !Number.isSafeInteger(value.budget) || value.budget <= 0)) return false;
  if (value.before !== undefined && !isRoomSnapshot(value.before)) return false;
  if (value.editedItems !== undefined && (!Array.isArray(value.editedItems) || !value.editedItems.every(isRoomItem) || new Set(value.editedItems.map(item => item.id)).size !== value.editedItems.length)) return false;
  if (value.generatedBy !== undefined && value.generatedBy !== "gemini" && value.generatedBy !== "mock") return false;
  if (value.keptObjectIds !== undefined && (!Array.isArray(value.keptObjectIds) || !value.keptObjectIds.every(nonemptyString) || new Set(value.keptObjectIds).size !== value.keptObjectIds.length)) return false;
  if (value.furnitureOperations !== undefined && !isFurnitureOperations(value.furnitureOperations)) return false;
  if (value.furnitureAdditions !== undefined && !isFurnitureAdditions(value.furnitureAdditions)) return false;
  if (value.productSource !== undefined && value.productSource !== "ec" && value.productSource !== "mock") return false;
  if (value.searchEntryPoints !== undefined && (!Array.isArray(value.searchEntryPoints) || !value.searchEntryPoints.every(nonemptyString))) return false;
  if (!optionalHttpUrl(value.modelUrl) || !Array.isArray(value.items) || !value.items.every(isRoomItem)) return false;
  const currentItems = value.items as RoomItem[];
  const editedItems = value.editedItems as RoomItem[] | undefined;
  const furniture = [...new Map([
    ...(value.before?.items ?? value.items).filter(item => item.existing && (!isManualFurniture(item) || currentItems.some(current => current.id === item.id || current.replacesObjectId === item.id) || editedItems?.some(current => current.id === item.id))),
    ...value.items.filter(isManualFurniture),
    ...(value.editedItems ?? []).filter(isManualFurniture),
  ].map(item => [item.id, item])).values()];
  if (value.keptObjectIds !== undefined) {
    if (value.keptObjectIds.some(id => !furniture.some(item => item.id === id))) return false;
  }
  if (value.furnitureOperations !== undefined) {
    if (value.furnitureOperations.length !== furniture.length || value.furnitureOperations.some(operation => !furniture.some(item => item.id === operation.objectId))) return false;
  }
  return new Set(value.items.map(item => item.id)).size === value.items.length;
}

function isInferredRoomBounds(value: unknown): boolean {
  if (!isRecord(value) || !finiteVector(value.min) || !finiteVector(value.max)) return false;
  const maximums = value.max;
  if (!value.min.every((minimum, axis) => minimum < maximums[axis])) return false;
  return typeof value.floor === 'number' && Number.isFinite(value.floor) && value.floor >= value.min[1] && value.floor < value.max[1];
}

function isRoomSnapshot(value: unknown): value is RoomSnapshot {
  if (!isRecord(value) || !isRoomGeometry(value.room)) return false;
  if (value.wallColor !== undefined && (typeof value.wallColor !== "string" || !/^#[0-9a-f]{6}$/i.test(value.wallColor))) return false;
  if (!Array.isArray(value.items) || !value.items.every(isRoomItem)) return false;
  return new Set(value.items.map(item => item.id)).size === value.items.length;
}

export function isRoomShape(value: unknown): value is RoomShape {
  return value === "square" || value === "standard" || value === "long";
}

function isTatami(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 3 && value <= 30;
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isRoomGeometry(value: unknown): value is RoomGeometry {
  if (!isRecord(value) || ![value.width, value.depth, value.height].every(positiveNumber)) return false;
  if (typeof value.floorColor !== "string" || !/^#[0-9a-f]{6}$/i.test(value.floorColor)) return false;
  if (!Array.isArray(value.windows) || !value.windows.every(isRoomWindow)) return false;
  return new Set(value.windows.map(window => window.id)).size === value.windows.length;
}

function isRoomWindow(value: unknown): value is RoomWindow {
  if (!isRecord(value) || !nonemptyString(value.id) || (value.wall !== "north" && value.wall !== "east" && value.wall !== "south" && value.wall !== "west")) return false;
  if (![value.width, value.height].every(positiveNumber)) return false;
  return [value.center, value.bottom].every(number => typeof number === "number" && Number.isFinite(number) && number >= 0);
}

export function isRoomItem(value: unknown): value is RoomItem {
  if (!isRecord(value)) return false;
  if (![value.id, value.name, value.category, value.color].every(nonemptyString) || typeof value.existing !== "boolean") return false;
  if (!finiteVector(value.position) || !finiteVector(value.size) || value.size.some(number => number <= 0)) return false;
  if (value.rotation !== undefined && (typeof value.rotation !== "number" || !Number.isFinite(value.rotation) || value.rotation < 0 || value.rotation >= 360)) return false;
  if (value.price !== undefined && (typeof value.price !== "number" || !Number.isFinite(value.price) || value.price < 0)) return false;
  if (value.marker !== undefined && (typeof value.marker !== "number" || !Number.isSafeInteger(value.marker) || value.marker <= 0)) return false;
  if (value.shop !== undefined && !nonemptyString(value.shop)) return false;
  if (value.productId !== undefined && (typeof value.productId !== "string" || !/^[1-9]\d*$/.test(value.productId))) return false;
  if (value.ecProductId !== undefined && (typeof value.ecProductId !== "string" || !/^[1-9]\d*$/.test(value.ecProductId))) return false;
  if (value.referenceImage !== undefined && (!(isManualFurniture(value as RoomItem) || isTemplateFurniture(value as RoomItem)) || !furnitureCategories.some(category => category === value.category) || !isImageArtwork(value.referenceImage))) return false;
  if (value.artwork !== undefined && (!(isManualFurniture(value as RoomItem) || isTemplateFurniture(value as RoomItem)) || !imageGoodsCategories.some(category => category === value.category) || !isImageArtwork(value.artwork))) return false;
  if (value.materialOverrides !== undefined && !isMaterialOverrides(value.materialOverrides)) return false;
  if (value.textureStatus !== undefined && !isTextureStatus(value.textureStatus)) return false;
  if (value.textureSource !== undefined && value.textureSource !== "description") return false;
  if (value.replacesObjectId !== undefined && !nonemptyString(value.replacesObjectId)) return false;
  if (value.modelMatch !== undefined && (!isRecord(value.modelMatch) || !nonemptyString(value.modelMatch.modelId) || !nonemptyString(value.modelMatch.reason) || typeof value.modelMatch.approximate !== "boolean")) return false;
  if (value.productMetadata !== undefined && !isProductMetadata(value.productMetadata)) return false;
  if (value.modelSize !== undefined && (!isRecord(value.modelSize) || ![value.modelSize.w, value.modelSize.h, value.modelSize.d].every(positiveNumber))) return false;
  if (value.modelFit !== undefined && value.modelFit !== "contain") return false;
  if (value.existing && (value.materialOverrides !== undefined || value.replacesObjectId !== undefined)) return false;
  return optionalHttpUrl(value.productUrl) && optionalHttpUrl(value.modelUrl) && optionalHttpUrl(value.imageUrl);
}

export function isFurnitureOperations(value: unknown): value is FurnitureOperation[] {
  return Array.isArray(value) && value.every(operation => isRecord(operation) && nonemptyString(operation.objectId) && (operation.action === "keep" || operation.action === "replace" || operation.action === "remove")) && new Set(value.map(operation => operation.objectId)).size === value.length;
}

export function isFurnitureAdditions(value: unknown): value is FurnitureAddition[] {
  return Array.isArray(value) && value.length <= 6 && value.every(addition => isRecord(addition) && furnitureCategories.some(category => category === addition.category));
}

export function isTextureStatus(value: unknown): value is TextureStatus {
  return value === "disabled" || value === "ready" || value === "failed" || value === "skipped" || value === "unmatched";
}

export function isMaterialOverrides(value: unknown): value is MaterialOverrides {
  return isRecord(value) && Object.entries(value).every(([name, override]) => nonemptyString(name) && isRecord(override) && optionalHttpUrl(override.textureUrl) && (override.tileSizeM === undefined || positiveNumber(override.tileSizeM)) && (override.color === undefined || typeof override.color === "string" && /^#[0-9a-f]{6}$/i.test(override.color)));
}

function isProductMetadata(value: unknown): value is ProductMetadata {
  if (!isRecord(value) || !optionalHttpUrl(value.sourceUrl)) return false;
  if (value.priceCheckedAt !== undefined && (typeof value.priceCheckedAt !== "string" || !Number.isFinite(Date.parse(value.priceCheckedAt)))) return false;
  if (![value.material, value.shape, value.availability, value.provider, value.providerProductId, value.variantId, value.officialColor].every(field => field === undefined || nonemptyString(field))) return false;
  if (value.colorVariants !== undefined && (!Array.isArray(value.colorVariants) || value.colorVariants.length > 24 || !value.colorVariants.every(variant => isRecord(variant) && nonemptyString(variant.colorName) && nonemptyString(variant.url) && optionalHttpUrl(variant.url) && (variant.variantId === undefined || nonemptyString(variant.variantId)) && (variant.source === "official_color_picker" || variant.source === "official_product_group")))) return false;
  if (value.estimatedAxes !== undefined && (!Array.isArray(value.estimatedAxes) || !value.estimatedAxes.every(axis => axis === "w" || axis === "h" || axis === "d"))) return false;
  if (value.size !== undefined && (!isRecord(value.size) || ![value.size.w, value.size.h, value.size.d].every(axis => axis === null || positiveNumber(axis)))) return false;
  if (value.imageDisplayAllowed !== undefined && typeof value.imageDisplayAllowed !== "boolean") return false;
  if (value.searchEntryPointHtml !== undefined && !nonemptyString(value.searchEntryPointHtml)) return false;
  if (value.sizeSource !== undefined && !nonemptyString(value.sizeSource)) {
    if (!isRecord(value.sizeSource) || !optionalHttpUrl(value.sizeSource.url) || value.sizeSource.kind !== undefined && !nonemptyString(value.sizeSource.kind)) return false;
    const evidence = value.sizeSource.evidence;
    if (evidence !== undefined && !nonemptyString(evidence) && (!Array.isArray(evidence) || !evidence.every(nonemptyString))) return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function finiteVector(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(number => typeof number === "number" && Number.isFinite(number));
}

function optionalHttpUrl(value: unknown): boolean {
  if (value === undefined) return true;
  if (!nonemptyString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
