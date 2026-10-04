export type Style = "botanical" | "oshi" | "natural";
export type RoomShape = "square" | "standard" | "long";
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

export type RoomItem = {
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
  marker?: number;
};

export type RoomSnapshot = { room: RoomGeometry; items: RoomItem[]; wallColor?: string };

export type RoomDesign = {
  kind?: "analysis" | "coordination";
  source: "demo" | "api";
  id: string;
  title: string;
  description: string;
  style: Style;
  items: RoomItem[];
  modelUrl?: string;
  // modelUrlがある場合、未指定なら家具を含む完成モデルとして扱う。
  modelKind?: "complete" | "shell";
  wallColor?: string;
  room?: RoomGeometry;
  analysisInput?: { tatami: number; shape: RoomShape };
  before?: RoomSnapshot;
  backendRoomId?: string;
  prompt?: string;
  budget?: number;
  keptObjectIds?: string[];
};

// ブラウザに保存されたデータも、復元時には信頼しない。
export function isRoomDesign(value: unknown): value is RoomDesign {
  if (!isRecord(value)) return false;
  if (value.source !== "demo" && value.source !== "api") return false;
  if (value.kind !== undefined && value.kind !== "analysis" && value.kind !== "coordination") return false;
  if (value.style !== "botanical" && value.style !== "oshi" && value.style !== "natural") return false;
  if (!nonemptyString(value.id) || !nonemptyString(value.title) || !nonemptyString(value.description)) return false;
  if (value.modelKind !== undefined && value.modelKind !== "complete" && value.modelKind !== "shell") return false;
  if (value.wallColor !== undefined && (typeof value.wallColor !== "string" || !/^#[0-9a-f]{6}$/i.test(value.wallColor))) return false;
  if (value.room !== undefined && !isRoomGeometry(value.room)) return false;
  if (value.analysisInput !== undefined && (!isRecord(value.analysisInput) || !isTatami(value.analysisInput.tatami) || !isRoomShape(value.analysisInput.shape))) return false;
  if (value.backendRoomId !== undefined && (typeof value.backendRoomId !== "string" || !/^[1-9]\d*$/.test(value.backendRoomId))) return false;
  if (value.prompt !== undefined && (!nonemptyString(value.prompt) || value.prompt.length > 500)) return false;
  if (value.budget !== undefined && (typeof value.budget !== "number" || !Number.isSafeInteger(value.budget) || value.budget <= 0)) return false;
  if (value.before !== undefined && !isRoomSnapshot(value.before)) return false;
  if (value.keptObjectIds !== undefined && (!Array.isArray(value.keptObjectIds) || !value.keptObjectIds.every(nonemptyString) || new Set(value.keptObjectIds).size !== value.keptObjectIds.length)) return false;
  if (!optionalHttpUrl(value.modelUrl) || !Array.isArray(value.items) || !value.items.every(isRoomItem)) return false;
  if (value.keptObjectIds !== undefined) {
    const furniture = (value.before?.items ?? value.items).filter(item => item.existing);
    if (value.keptObjectIds.some(id => !furniture.some(item => item.id === id))) return false;
  }
  return new Set(value.items.map(item => item.id)).size === value.items.length;
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

function isRoomItem(value: unknown): value is RoomItem {
  if (!isRecord(value)) return false;
  if (![value.id, value.name, value.category, value.color].every(nonemptyString) || typeof value.existing !== "boolean") return false;
  if (!finiteVector(value.position) || !finiteVector(value.size) || value.size.some(number => number <= 0)) return false;
  if (value.rotation !== undefined && (typeof value.rotation !== "number" || !Number.isFinite(value.rotation) || value.rotation < 0 || value.rotation >= 360)) return false;
  if (value.price !== undefined && (typeof value.price !== "number" || !Number.isFinite(value.price) || value.price < 0)) return false;
  if (value.marker !== undefined && (typeof value.marker !== "number" || !Number.isSafeInteger(value.marker) || value.marker <= 0)) return false;
  if (value.shop !== undefined && !nonemptyString(value.shop)) return false;
  return optionalHttpUrl(value.productUrl) && optionalHttpUrl(value.modelUrl) && optionalHttpUrl(value.imageUrl);
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
