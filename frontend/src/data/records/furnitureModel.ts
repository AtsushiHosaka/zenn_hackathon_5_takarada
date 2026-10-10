import type { FurnitureModel, FurnitureModelCredit } from "../../domain/furnitureModel";
import type { components } from "../generated/api";

export type FurnitureModelRecord = components["schemas"]["FurnitureModel"];

// カタログは描画の補助情報。壊れた行は使わず、その家具の簡易形状を残す。
export function toFurnitureModel(value: unknown): FurnitureModel | undefined {
  if (!isFurnitureModelRecord(value)) return undefined;
  const record = value;
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    shape: record.shape,
    variant: record.variant,
    format: record.format,
    objectKey: record.object_key,
    size: record.size,
    unit: record.unit,
    axes: record.axes,
    triangleCount: record.triangle_count,
    byteSize: record.byte_size,
    sha256: record.sha256,
    materials: record.materials,
    modelUrl: record.model_url,
    bindings: record.bindings,
    // 推し活グッズ以前の台帳・APIでは省略されるため、空として扱う。
    goodsType: record.goods_type ?? null,
    characters: record.characters ?? [],
    searchTerms: record.search_terms ?? [],
    credits: (record.credits ?? []).map((credit): FurnitureModelCredit => ({ franchise: credit.franchise, credit: credit.credit?.trim() || null, notice: credit.notice?.trim() || null, licenseUrl: credit.license_url ?? null })),
  };
}

function isFurnitureModelRecord(value: unknown): value is FurnitureModelRecord {
  if (!isRecord(value)) return false;
  if (![value.id, value.name, value.category, value.shape, value.object_key].every(nonemptyString)) return false;
  if (value.variant !== null && typeof value.variant !== "string") return false;
  if (value.format !== "glb" || value.unit !== "meter" || value.axes !== "+Y up, +Z front, origin bottom center") return false;
  if (!isRecord(value.size) || ![value.size.w, value.size.h, value.size.d].every(positiveNumber)) return false;
  if (!nonnegativeInteger(value.triangle_count) || !nonnegativeInteger(value.byte_size) || value.byte_size === 0) return false;
  if (typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.sha256)) return false;
  if (!Array.isArray(value.materials) || !value.materials.every(material => typeof material === "string")) return false;
  if (value.model_url !== null && !isHttpUrl(value.model_url)) return false;
  if (value.goods_type != null && !nonemptyString(value.goods_type)) return false;
  if (!optionalStrings(value.characters) || !optionalStrings(value.search_terms)) return false;
  // クレジットは権利表記のため、壊れていればモデルごと使わない。
  if (value.credits != null && (!Array.isArray(value.credits) || !value.credits.every(credit => isRecord(credit) && nonemptyString(credit.franchise)
    && [credit.credit, credit.notice].every(field => field == null || typeof field === "string")
    && (credit.license_url == null || isHttpUrl(credit.license_url))))) return false;
  return Array.isArray(value.bindings) && value.bindings.every(binding => {
    if (!isRecord(binding) || !nonemptyString(binding.reference)) return false;
    return binding.kind === "existing" || (binding.kind === "product" && /^[1-9]\d*$/.test(binding.reference));
  });
}

function optionalStrings(value: unknown): boolean {
  return value == null || Array.isArray(value) && value.every(nonemptyString);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isHttpUrl(value: unknown): value is string {
  if (!nonemptyString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
