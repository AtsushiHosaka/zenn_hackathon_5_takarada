import { DomainError } from "../../domain/error";
import type { MaterialOverrides, ProductMetadata, RoomDesign, RoomItem, RoomShape, RoomSnapshot, Style } from "../../domain/room";
import { productCategories, furnitureCategories, isManualFurniture, isRoomDesign, isRoomItem, isRoomShape, isTextureStatus } from "../../domain/room";
import type { FurnitureSearchResult, SavedRoom } from "../../domain/roomRepository";
import type { components } from "../generated/api";

export type AnalysisRoomRecord = components["schemas"]["Room"];
export type CoordinationRecord = components["schemas"]["Coordination"];

export type UploadRecord = components["schemas"]["Upload"];

export function toFurnitureSearch(value: unknown, baseUrl: string): FurnitureSearchResult {
  const record = object(value, "FurnitureSearch");
  if (!Array.isArray(record.products) || record.products.length > 24 || !Array.isArray(record.search_entry_points)) invalid("FurnitureSearch");
  return { products: record.products.map(product => toImportedFurniture(product, baseUrl)), failures: nonnegativeInteger(record.failures, "FurnitureSearch.failures"), searchEntryPoints: record.search_entry_points.map(entry => text(entry, "search_entry_point")) };
}

export function toImportedFurniture(value: unknown, baseUrl: string): RoomItem {
  const record = object(value, "FurnitureImport");
  const category = productCategories.find(category => category === record.category);
  if (!category) invalid("FurnitureImport.category");
  const size = sizeRecord(record.size);
  const match = record.model_match == null ? undefined : modelMatchRecord(record.model_match);
  const item: RoomItem = {
    id: `manual-${crypto.randomUUID()}`, existing: true,
    ecProductId: String(integer(record.ec_product_id, "ec_product_id")),
    name: text(record.name, "FurnitureImport.name"), category,
    color: hexColor(record.color, "FurnitureImport.color"),
    size: [size.w, size.h, size.d], position: [0, size.h / 2, 0], rotation: 0,
    price: nonnegativeInteger(record.price, "FurnitureImport.price"),
    shop: text(record.shop, "FurnitureImport.shop"),
    productUrl: url(text(record.url, "FurnitureImport.url"), baseUrl),
    imageUrl: url(record.image_url, baseUrl),
    productMetadata: productMetadata(record.product_metadata, baseUrl),
    modelUrl: url(record.model_url, baseUrl),
    modelMatch: match && { modelId: String(match.model_id), reason: match.reason, approximate: match.approximate },
    modelSize: record.model_size == null ? undefined : sizeRecord(record.model_size),
    modelFit: record.model_fit == null ? undefined : containFit(record.model_fit),
  };
  if (!isRoomItem(item)) invalid("FurnitureImport");
  return item;
}

export function toSavedRoom(value: unknown, baseUrl: string): SavedRoom {
  const record = toAnalysisRoomRecord(value);
  const latest = record.latest_coordination;
  const design = record.status === "ready"
    ? latest
      ? toCoordinatedRoomDesign(latest, baseUrl, { tatami: record.tatami, shape: record.shape })
      : toAnalyzedRoomDesign(record, baseUrl)
    : undefined;
  return {
    id: String(record.id),
    title: design?.title ?? `${record.tatami}畳の部屋`,
    createdAt: record.created_at,
    status: record.status,
    design,
    errorMessage: record.error_message ?? undefined,
  };
}

export function toSavedRooms(value: unknown, baseUrl: string): SavedRoom[] {
  if (!Array.isArray(value)) invalid("Rooms");
  const rooms = value.map(record => toSavedRoom(record, baseUrl));
  if (new Set(rooms.map(room => room.id)).size !== rooms.length) invalid("Rooms.id の重複");
  return rooms;
}

// 発行されたアップロード先。枚数が合わないとFileとkeyの対応が崩れるので数も見る
export function toUploadRecords(value: unknown, expected: number): UploadRecord[] {
  if (!Array.isArray(value) || value.length !== expected) invalid("Upload");
  return value.map(item => {
    const record = object(item, "Upload");
    const uploadUrl = text(record.upload_url, "Upload.upload_url");
    if (!/^https?:\/\//.test(uploadUrl)) invalid("Upload.upload_url");
    return { key: text(record.key, "Upload.key"), upload_url: uploadUrl };
  });
}

export function toCoordinationRecord(value: unknown): CoordinationRecord {
  const record = object(value, "Coordination");
  if (record.status !== "pending" && record.status !== "processing" && record.status !== "done" && record.status !== "failed") invalid("Coordination.status");
  if (!Array.isArray(record.kept_object_ids) || record.kept_object_ids.some(id => typeof id !== "string" || !id.trim())) invalid("Coordination.kept_object_ids");
  if (!Array.isArray(record.items)) invalid("Coordination.items");
  const createdAt = text(record.created_at, "Coordination.created_at");
  if (!Number.isFinite(Date.parse(createdAt))) invalid("Coordination.created_at");
  const totalPrice = record.total_price === null ? null : nonnegativeInteger(record.total_price, "Coordination.total_price");
  const parsed: CoordinationRecord = {
    id: integer(record.id, "Coordination.id"),
    room_id: integer(record.room_id, "Coordination.room_id"),
    status: record.status,
    prompt: text(record.prompt, "Coordination.prompt"),
    budget: integer(record.budget, "Coordination.budget"),
    kept_object_ids: record.kept_object_ids as string[],
    title: nullableText(record.title, "Coordination.title"),
    comment: nullableText(record.comment, "Coordination.comment"),
    before_scene: record.before_scene === null ? null : analysisScene(record.before_scene),
    after_scene: record.after_scene === null ? null : analysisScene(record.after_scene),
    items: record.items.map(coordinationItem),
    total_price: totalPrice,
    // 商品の選び方 (gemini: 要望文から AI が選んだ / mock: モック) は古い API では返らない
    planned_by: record.planned_by === "gemini" || record.planned_by === "mock" ? record.planned_by : null,
    // 追加の指示で作り直したときの前回のコーデ (古い API では返らない)
    base_coordination_id: typeof record.base_coordination_id === "number" && Number.isInteger(record.base_coordination_id) && record.base_coordination_id > 0 ? record.base_coordination_id : null,
    error_message: nullableText(record.error_message, "Coordination.error_message"),
    created_at: createdAt,
    furniture_operations: record.furniture_operations == null || Array.isArray(record.furniture_operations) && record.furniture_operations.length === 0 ? undefined : furnitureOperations(record.furniture_operations),
    additions: record.additions == null ? undefined : furnitureAdditions(record.additions),
    product_source: productSource(record.product_source),
    search_entry_points: record.search_entry_points == null ? undefined : searchEntryPoints(record.search_entry_points),
  };
  if (new Set(parsed.items.map(item => item.marker)).size !== parsed.items.length) invalid("Coordination.items.marker の重複");
  if (parsed.status === "done") {
    if (!parsed.before_scene || !parsed.after_scene || !parsed.title || !parsed.comment || parsed.total_price === null) invalid("Coordination.done");
    const suggestions = parsed.after_scene.objects.filter(item => item.source === "suggested");
    if (suggestions.length !== parsed.items.length) invalid("Coordination.items と配置の不一致");
    if (new Set(suggestions.map(item => item.marker)).size !== suggestions.length) invalid("SceneObject.marker の重複");
    suggestions.forEach(item => {
      if (!parsed.items.some(product => product.marker === item.marker && product.item_id === item.item_id)) invalid("Coordination.marker/item_id");
    });
    if (parsed.total_price !== parsed.items.reduce((sum, item) => sum + item.price, 0) || parsed.total_price > parsed.budget) invalid("Coordination.total_price");
  }
  return parsed;
}

export function toCoordinatedRoomDesign(value: unknown, baseUrl: string, analysisInput: { tatami: number; shape: RoomShape }): RoomDesign {
  const record = toCoordinationRecord(value);
  if (record.status !== "done" || !record.before_scene || !record.after_scene || !record.title || !record.comment) throw new DomainError("コーディネートはまだ完了していません");
  const after = sceneSnapshot(record.after_scene, baseUrl);
  const before = sceneSnapshot(record.before_scene, baseUrl);
  const design: RoomDesign = {
    source: "api",
    kind: "coordination",
    id: `api-coordination-${record.id}`,
    title: record.title,
    description: record.comment,
    ...(record.planned_by ? { generatedBy: record.planned_by } : {}),
    style: record.title === "ラベンダーの推し活ルーム" ? "oshi" : record.title === "グリーンが映えるボタニカルルーム" ? "botanical" : "natural",
    ...after,
    items: after.items.map(item => {
      if (item.existing) return item;
      const product = record.items.find(product => product.marker === item.marker);
      if (!product) invalid("Coordination.items");
      const metadata = productMetadata(product.product_metadata, baseUrl);
      return {
        ...item,
        name: product.name,
        price: product.price,
        shop: productShopLabel(product.shop, product.url),
        productUrl: url(product.url, baseUrl),
        imageUrl: url(product.image_url, baseUrl),
        productMetadata: metadata,
      };
    }),
    before,
    editedItems: before.items.filter(isManualFurniture),
    backendRoomId: String(record.room_id),
    analysisInput,
    prompt: record.prompt,
    budget: record.budget,
    keptObjectIds: record.furniture_operations !== undefined ? record.furniture_operations.filter(operation => operation.action === "keep").map(operation => operation.object_id) : record.kept_object_ids.length > 0 ? record.kept_object_ids : record.before_scene.objects.filter(item => item.source === "existing").map(item => item.id),
    furnitureOperations: record.furniture_operations?.map(operation => ({ objectId: operation.object_id, action: operation.action })),
    furnitureAdditions: record.additions,
    productSource: record.product_source ?? undefined,
    searchEntryPoints: [...new Set([...(record.search_entry_points ?? []), ...record.items.flatMap(item => {
      const metadata = productMetadata(item.product_metadata, baseUrl);
      return metadata?.searchEntryPointHtml ? [metadata.searchEntryPointHtml] : [];
    })])],
  };
  if (!isRoomDesign(design)) invalid("Coordination の部屋データ");
  return design;
}

function sceneSnapshot(scene: components["schemas"]["Scene"], baseUrl: string): RoomSnapshot {
  const { room } = scene;
  return {
    room: { width: room.width, depth: room.depth, height: room.height, floorColor: room.floor_color, windows: room.windows },
    wallColor: room.wall_color,
    items: scene.objects.map(item => ({
      id: item.id,
      name: item.label,
      category: item.category,
      existing: item.source === "existing",
      color: item.color,
      position: [item.position.x - room.width / 2, item.position.y + item.size.h / 2, item.position.z - room.depth / 2],
      size: [item.size.w, item.size.h, item.size.d],
      rotation: item.rotation_y,
      marker: item.marker ?? undefined,
      productId: item.item_id === null ? undefined : String(item.item_id),
      modelUrl: item.source === "suggested" && item.texture_status === "unmatched" ? undefined : url(item.model_url, baseUrl),
      ...sceneProductDetails(item, baseUrl),
    })),
  };
}

function coordinationItem(value: unknown): components["schemas"]["CoordinationItem"] {
  const record = object(value, "CoordinationItem");
  return {
    marker: integer(record.marker, "CoordinationItem.marker"),
    item_id: integer(record.item_id, "CoordinationItem.item_id"),
    slot: text(record.slot, "CoordinationItem.slot"),
    category: text(record.category, "CoordinationItem.category"),
    name: text(record.name, "CoordinationItem.name"),
    price: nonnegativeInteger(record.price, "CoordinationItem.price"),
    shop: text(record.shop, "CoordinationItem.shop"),
    url: text(record.url, "CoordinationItem.url"),
    image_url: nullableText(record.image_url, "CoordinationItem.image_url"),
    color: text(record.color, "CoordinationItem.color"),
    placement_note: text(record.placement_note, "CoordinationItem.placement_note"),
    product_metadata: record.product_metadata == null ? undefined : object(record.product_metadata, "CoordinationItem.product_metadata"),
  };
}

function productShopLabel(shop: string, productUrl: string): string {
  const labels: Record<string, string> = {
    amazon: "Amazon",
    rakuten: "楽天市場",
    ikea: "IKEA",
    nitori: "ニトリ",
    nitori_yahoo: "ニトリ Yahoo!店",
    lowya: "LOWYA",
    muji: "無印良品",
    francfranc: "Francfranc",
    kaja: "KAJA",
  };
  const label = labels[shop] ?? shop;
  const search = /^https:\/\/(?:search\.rakuten\.co\.jp\/search\/mall\/|www\.amazon\.co\.jp\/s(?:\?|$))/.test(productUrl);
  return search ? `${label}（検索）` : label;
}

function furnitureOperations(value: unknown): { object_id: string; action: "keep" | "replace" | "remove" }[] {
  if (!Array.isArray(value)) invalid("furniture_operations");
  const operations = value.map((value): { object_id: string; action: "keep" | "replace" | "remove" } => {
    const operation = object(value, "furniture_operations");
    if (operation.action !== "keep" && operation.action !== "replace" && operation.action !== "remove") invalid("furniture_operations.action");
    return { object_id: text(operation.object_id, "furniture_operations.object_id"), action: operation.action };
  });
  if (new Set(operations.map(operation => operation.object_id)).size !== operations.length) invalid("furniture_operations の重複");
  return operations;
}

function furnitureAdditions(value: unknown) {
  if (!Array.isArray(value) || value.length > 6) invalid("additions");
  return value.map(value => {
    const addition = object(value, "additions");
    const category = furnitureCategories.find(category => category === addition.category);
    if (!category) invalid("additions.category");
    return { category };
  });
}

function productSource(value: unknown): "ec" | "mock" | null {
  if (value == null) return null;
  if (value !== "ec" && value !== "mock") invalid("product_source");
  return value;
}

function searchEntryPoints(value: unknown): string[] {
  if (!Array.isArray(value)) invalid("search_entry_points");
  return value.map(html => text(html, "search_entry_points.html"));
}

function textureStatus(value: unknown) {
  if (value == null) return undefined;
  if (!isTextureStatus(value)) invalid("texture_status");
  return value;
}

function descriptionSource(value: unknown): "description" {
  if (value !== "description") invalid("texture_source");
  return value;
}

function containFit(value: unknown): "contain" {
  if (value !== "contain") invalid("model_fit");
  return value;
}

function sizeRecord(value: unknown) {
  const size = object(value, "size");
  return { w: positive(size.w, "size.w"), h: positive(size.h, "size.h"), d: positive(size.d, "size.d") };
}

function modelMatchRecord(value: unknown) {
  const match = object(value, "model_match");
  if (typeof match.approximate !== "boolean") invalid("model_match.approximate");
  return { model_id: integer(match.model_id, "model_match.model_id"), reason: text(match.reason, "model_match.reason"), approximate: match.approximate };
}

function materialOverridesRecord(value: unknown) {
  const overrides = object(value, "material_overrides");
  return Object.fromEntries(Object.entries(overrides).map(([name, value]) => {
    const override = object(value, "material_overrides.material");
    return [text(name, "material_overrides.name"), {
      ...(override.texture_url == null ? {} : { texture_url: text(override.texture_url, "texture_url") }),
      ...(override.tile_size_m == null ? {} : { tile_size_m: positive(override.tile_size_m, "tile_size_m") }),
      ...(override.color == null ? {} : { color: hexColor(override.color, "material_overrides.color") }),
    }];
  }));
}

function sceneProductDetails(item: components["schemas"]["SceneObject"], baseUrl: string): Partial<RoomItem> {
  // リンクから追加した家具は出典と近似モデルをBeforeにも引き継ぐ。
  if (item.source === "existing") return item.ec_product_id == null ? {} : {
    ecProductId: String(item.ec_product_id),
    price: item.price ?? undefined, shop: item.shop ?? undefined,
    productUrl: url(item.url, baseUrl), productMetadata: productMetadata(item.product_metadata, baseUrl),
    imageUrl: url(item.image_url, baseUrl),
    modelMatch: item.model_match == null ? undefined : { modelId: String(item.model_match.model_id), reason: item.model_match.reason, approximate: item.model_match.approximate },
    modelSize: item.model_size ?? undefined, modelFit: item.model_fit ?? undefined,
  };
  const materialOverrides: MaterialOverrides | undefined = item.material_overrides == null ? undefined : Object.fromEntries(Object.entries(item.material_overrides).map(([name, override]) => [name, {
    textureUrl: url(override.texture_url, baseUrl), tileSizeM: override.tile_size_m ?? undefined, color: override.color ?? undefined,
  }]));
  return {
    ecProductId: item.ec_product_id == null ? undefined : String(item.ec_product_id),
    materialOverrides,
    textureStatus: item.texture_status ?? undefined,
    textureSource: item.texture_source ?? undefined,
    modelMatch: item.model_match == null ? undefined : { modelId: String(item.model_match.model_id), reason: item.model_match.reason, approximate: item.model_match.approximate },
    modelSize: item.model_size ?? undefined,
    modelFit: item.model_fit ?? undefined,
    replacesObjectId: item.replaces_object_id ?? undefined,
  };
}

function productMetadata(value: unknown, baseUrl: string): ProductMetadata | undefined {
  if (value == null) return undefined;
  const metadata = object(value, "product_metadata");
  const result: ProductMetadata = {};
  if (metadata.provider != null) result.provider = text(metadata.provider, "provider");
  if (metadata.provider_product_id != null) result.providerProductId = text(metadata.provider_product_id, "provider_product_id");
  if (metadata.variant_id != null) result.variantId = text(metadata.variant_id, "variant_id");
  if (metadata.official_color != null) result.officialColor = text(metadata.official_color, "official_color");
  if (metadata.color_variants != null) {
    if (!Array.isArray(metadata.color_variants) || metadata.color_variants.length > 24) invalid("color_variants");
    result.colorVariants = metadata.color_variants.map(value => {
      const variant = object(value, "color_variant");
      if (variant.source !== "official_color_picker" && variant.source !== "official_product_group") invalid("color_variant.source");
      return { colorName: text(variant.color_name, "color_variant.color_name"), url: url(text(variant.url, "color_variant.url"), baseUrl)!, variantId: optionalText(variant.variant_id, "color_variant.variant_id"), source: variant.source };
    });
  }
  if (metadata.source_url != null) result.sourceUrl = url(metadata.source_url, baseUrl);
  if (metadata.price_checked_at != null) {
    const checkedAt = text(metadata.price_checked_at, "price_checked_at");
    if (!Number.isFinite(Date.parse(checkedAt))) invalid("price_checked_at");
    result.priceCheckedAt = checkedAt;
  }
  if (metadata.estimated_axes != null) {
    if (!Array.isArray(metadata.estimated_axes)) invalid("estimated_axes");
    result.estimatedAxes = metadata.estimated_axes.map(axis => {
      if (axis !== "w" && axis !== "h" && axis !== "d") invalid("estimated_axes");
      return axis;
    });
  }
  if (metadata.size != null) {
    const size = object(metadata.size, "product_metadata.size");
    result.size = { w: size.w == null ? null : positive(size.w, "product_metadata.size.w"), h: size.h == null ? null : positive(size.h, "product_metadata.size.h"), d: size.d == null ? null : positive(size.d, "product_metadata.size.d") };
  }
  if (metadata.size_source != null) {
    if (typeof metadata.size_source === "string") result.sizeSource = text(metadata.size_source, "size_source");
    else {
      const source = object(metadata.size_source, "size_source");
      result.sizeSource = { url: url(source.url, baseUrl), evidence: source.evidence == null ? undefined : Array.isArray(source.evidence) ? source.evidence.map(evidence => text(evidence, "size_source.evidence")) : text(source.evidence, "size_source.evidence"), kind: optionalText(source.kind, "size_source.kind") };
    }
  }
  if (metadata.material != null && metadata.material !== "") result.material = text(metadata.material, "material");
  if (metadata.shape != null && metadata.shape !== "") result.shape = text(metadata.shape, "shape");
  if (metadata.availability != null) result.availability = text(metadata.availability, "availability");
  if (metadata.image_usage != null) result.imageDisplayAllowed = object(metadata.image_usage, "image_usage").display === "allowed";
  if (metadata.search_entry_point_html != null) result.searchEntryPointHtml = text(metadata.search_entry_point_html, "search_entry_point_html");
  return result;
}

function integer(value: unknown, field: string): number {
  const number = positive(value, field);
  if (!Number.isSafeInteger(number)) invalid(field);
  return number;
}

function nonnegativeInteger(value: unknown, field: string): number {
  const number = finite(value, field);
  if (!Number.isSafeInteger(number) || number < 0) invalid(field);
  return number;
}

// 正式な部屋解析APIの状態・シーンを、unknownから検証して取り出す。
export function toAnalysisRoomRecord(value: unknown): AnalysisRoomRecord {
  const record = object(value, "Room");
  if (typeof record.id !== "number" || !Number.isInteger(record.id) || record.id <= 0) invalid("Room.id");
  const tatami = finite(record.tatami, "Room.tatami");
  if (tatami < 3 || tatami > 30) invalid("Room.tatami");
  if (!isRoomShape(record.shape)) invalid("Room.shape");
  if (record.status !== "analyzing" && record.status !== "ready" && record.status !== "failed") invalid("Room.status");
  const createdAt = text(record.created_at, "Room.created_at");
  if (!Number.isFinite(Date.parse(createdAt))) invalid("Room.created_at");
  const scene = record.scene === null ? null : analysisScene(record.scene);
  if (record.status === "ready" && !scene) invalid("Room.scene");
  const latestCoordination = record.latest_coordination == null ? null : toCoordinationRecord(record.latest_coordination);
  if (latestCoordination && (latestCoordination.status !== "done" || latestCoordination.room_id !== record.id)) invalid("Room.latest_coordination");
  // 解析方法 (gemini: 写真を AI で解析 / mock: モック) は古い API では返らない
  const analyzedBy = record.analyzed_by === "gemini" || record.analyzed_by === "mock" ? record.analyzed_by : null;
  return {
    id: record.id,
    tatami,
    shape: record.shape,
    status: record.status,
    scene,
    latest_coordination: latestCoordination,
    analyzed_by: analyzedBy,
    error_message: nullableText(record.error_message, "Room.error_message"),
    created_at: createdAt,
  };
}

export function toAnalyzedRoomDesign(value: unknown, baseUrl: string): RoomDesign {
  const record = toAnalysisRoomRecord(value);
  if (record.status !== "ready" || !record.scene) throw new DomainError("部屋の解析はまだ完了していません");
  const { room, objects } = record.scene;
  return {
    source: "api",
    kind: "analysis",
    id: `api-room-${record.id}`,
    title: `${record.tatami}畳の部屋`,
    description: `${record.tatami}畳の部屋を作成しました。`,
    ...(record.analyzed_by ? { generatedBy: record.analyzed_by } : {}),
    style: "natural",
    wallColor: room.wall_color,
    room: { width: room.width, depth: room.depth, height: room.height, floorColor: room.floor_color, windows: room.windows },
    analysisInput: { tatami: record.tatami, shape: record.shape },
    backendRoomId: String(record.id),
    items: objects.map(item => ({
      id: item.id,
      name: item.label,
      category: item.category,
      existing: item.source === "existing",
      color: item.color,
      position: [item.position.x - room.width / 2, item.position.y + item.size.h / 2, item.position.z - room.depth / 2],
      size: [item.size.w, item.size.h, item.size.d],
      rotation: item.rotation_y,
      productId: item.item_id === null ? undefined : String(item.item_id),
      modelUrl: url(item.model_url, baseUrl),
    })),
  };
}

function analysisScene(value: unknown): components["schemas"]["Scene"] {
  const record = object(value, "Scene");
  const room = object(record.room, "Scene.room");
  if (!Array.isArray(room.windows)) invalid("Scene.room.windows");
  if (!Array.isArray(record.objects)) invalid("Scene.objects");
  const windows = room.windows.map(analysisWindow);
  const objects = record.objects.map(analysisObject);
  if (new Set(windows.map(window => window.id)).size !== windows.length) invalid("windows.id の重複");
  if (new Set(objects.map(item => item.id)).size !== objects.length) invalid("objects.id の重複");
  return {
    room: {
      width: positive(room.width, "room.width"),
      depth: positive(room.depth, "room.depth"),
      height: positive(room.height, "room.height"),
      wall_color: hexColor(room.wall_color, "room.wall_color"),
      floor_color: hexColor(room.floor_color, "room.floor_color"),
      windows,
    },
    objects,
  };
}

function analysisWindow(value: unknown): components["schemas"]["Window"] {
  const record = object(value, "Window");
  if (record.wall !== "north" && record.wall !== "south" && record.wall !== "east" && record.wall !== "west") invalid("Window.wall");
  const center = finite(record.center, "Window.center");
  const bottom = finite(record.bottom, "Window.bottom");
  if (center < 0 || bottom < 0) invalid("Window.center/bottom");
  return { id: text(record.id, "Window.id"), wall: record.wall, center, bottom, width: positive(record.width, "Window.width"), height: positive(record.height, "Window.height") };
}

function analysisObject(value: unknown): components["schemas"]["SceneObject"] {
  const record = object(value, "SceneObject");
  const size = object(record.size, "SceneObject.size");
  const position = object(record.position, "SceneObject.position");
  if (record.source !== "existing" && record.source !== "suggested") invalid("SceneObject.source");
  if (typeof record.rotation_y !== "number" || !Number.isFinite(record.rotation_y) || record.rotation_y < 0 || record.rotation_y >= 360) invalid("SceneObject.rotation_y");
  if (record.slot !== null && record.slot !== "bed_cover" && record.slot !== "curtain" && record.slot !== "rug" && record.slot !== "wall_decor" && record.slot !== "light" && record.slot !== "display" && record.slot !== "cushion" && record.slot !== "desk_top" && record.slot !== "floor") invalid("SceneObject.slot");
  return {
    id: text(record.id, "SceneObject.id"),
    source: record.source,
    category: text(record.category, "SceneObject.category"),
    label: text(record.label, "SceneObject.label"),
    size: { w: positive(size.w, "size.w"), h: positive(size.h, "size.h"), d: positive(size.d, "size.d") },
    position: { x: finite(position.x, "position.x"), y: finite(position.y, "position.y"), z: finite(position.z, "position.z") },
    rotation_y: record.rotation_y,
    color: text(record.color, "SceneObject.color"),
    model_url: nullableText(record.model_url, "SceneObject.model_url"),
    slot: record.slot,
    attach_to: nullableText(record.attach_to, "SceneObject.attach_to"),
    item_id: nullableInteger(record.item_id, "SceneObject.item_id"),
    marker: nullableInteger(record.marker, "SceneObject.marker"),
    material_overrides: record.material_overrides == null ? undefined : materialOverridesRecord(record.material_overrides),
    texture_status: textureStatus(record.texture_status),
    texture_source: record.texture_source == null ? undefined : descriptionSource(record.texture_source),
    model_match: record.model_match == null ? undefined : modelMatchRecord(record.model_match),
    model_size: record.model_size == null ? undefined : sizeRecord(record.model_size),
    model_fit: record.model_fit == null ? undefined : containFit(record.model_fit),
    replaces_object_id: record.replaces_object_id == null ? undefined : text(record.replaces_object_id, "SceneObject.replaces_object_id"),
    ec_product_id: record.ec_product_id == null ? undefined : integer(record.ec_product_id, "SceneObject.ec_product_id"),
    price: record.price == null ? undefined : nonnegativeInteger(record.price, "SceneObject.price"),
    shop: record.shop == null ? undefined : text(record.shop, "SceneObject.shop"),
    url: record.url == null ? undefined : text(record.url, "SceneObject.url"),
    image_url: record.image_url == null ? undefined : text(record.image_url, "SceneObject.image_url"),
    product_metadata: record.product_metadata == null ? undefined : object(record.product_metadata, "SceneObject.product_metadata"),
  };
}

function finite(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(field);
  return value;
}

function positive(value: unknown, field: string): number {
  const number = finite(value, field);
  if (number <= 0) invalid(field);
  return number;
}

function nullableText(value: unknown, field: string): string | null {
  return value === null ? null : text(value, field);
}

function nullableInteger(value: unknown, field: string): number | null {
  if (value === null) return null;
  const number = positive(value, field);
  if (!Number.isInteger(number)) invalid(field);
  return number;
}

function hexColor(value: unknown, field: string): string {
  const color = text(value, field);
  if (!/^#[0-9a-f]{6}$/i.test(color)) invalid(field);
  return color;
}

// 未公開API向けの提案形式。正式契約との違いはこの変換だけで吸収する。
export function toRoomDesign(value: unknown, baseUrl: string): RoomDesign {
  const record = object(value, "部屋");
  const style = text(record.style, "style");
  if (!["botanical", "oshi", "natural"].includes(style)) invalid("style");
  if (!Array.isArray(record.items)) invalid("items");
  const items = record.items.map(value => toRoomItem(value, baseUrl));
  if (new Set(items.map(item => item.id)).size !== items.length) invalid("items.id の重複");
  const modelKind = record.model_kind ?? record.modelKind;
  if (modelKind !== undefined && modelKind !== "complete" && modelKind !== "shell") invalid("model_kind");
  return {
    source: "api",
    id: identifier(record.id, "id"),
    title: text(record.title, "title"),
    description: text(record.description, "description"),
    style: style as Style,
    items,
    modelUrl: url(record.model_url ?? record.modelUrl, baseUrl),
    modelKind,
    wallColor: wallColor(record.wallColor !== undefined ? record.wallColor : record.wall_color),
  };
}

function toRoomItem(value: unknown, baseUrl: string): RoomItem {
  const record = object(value, "家具");
  if (typeof record.existing !== "boolean") invalid("existing");
  const size = vector(record.size, "size");
  if (size.some(number => number <= 0)) invalid("size");
  const price = record.price;
  if (price !== undefined && (typeof price !== "number" || !Number.isFinite(price) || price < 0)) invalid("price");
  return {
    id: identifier(record.id, "items.id"),
    name: text(record.name, "name"),
    category: text(record.category, "category"),
    existing: record.existing,
    color: text(record.color, "color"),
    position: vector(record.position, "position"),
    size,
    rotation: rotation(record.rotation !== undefined ? record.rotation : record.rotation_degrees),
    price: price as number | undefined,
    shop: optionalText(record.shop, "shop"),
    productUrl: url(record.product_url ?? record.productUrl, baseUrl),
    imageUrl: url(record.image_url ?? record.imageUrl, baseUrl),
    modelUrl: url(record.model_url ?? record.modelUrl, baseUrl),
  };
}

function rotation(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 360) invalid("rotation");
  return value;
}

function wallColor(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) invalid("wall_color");
  return value;
}

function invalid(field: string): never {
  throw new DomainError(`部屋データの形式が正しくありません (${field})`);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(field);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) invalid(field);
  return value;
}

function optionalText(value: unknown, field: string): string | undefined {
  return value === undefined || value === null ? undefined : text(value, field);
}

function identifier(value: unknown, field: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return text(value, field);
}

function vector(value: unknown, field: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || value.some(number => typeof number !== "number" || !Number.isFinite(number))) invalid(field);
  return value as [number, number, number];
}

function url(value: unknown, baseUrl: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    const parsed = new URL(text(value, "URL"), baseUrl);
    if (!["https:", "http:"].includes(parsed.protocol)) invalid("URL");
    return parsed.href;
  } catch {
    return invalid("URL");
  }
}
