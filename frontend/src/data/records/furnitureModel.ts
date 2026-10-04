import type { FurnitureModel } from "../../domain/furnitureModel";
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
  return Array.isArray(value.bindings) && value.bindings.every(binding => {
    if (!isRecord(binding) || !nonemptyString(binding.reference)) return false;
    return binding.kind === "existing" || (binding.kind === "product" && /^[1-9]\d*$/.test(binding.reference));
  });
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
