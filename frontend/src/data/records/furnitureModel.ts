import type { FurnitureModel } from "../../domain/furnitureModel";
import type { components } from "../generated/api";

export type FurnitureModelRecord = components["schemas"]["FurnitureModel"];

export function toFurnitureModel(record: FurnitureModelRecord): FurnitureModel {
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
