import type { components } from "../generated/api";
import type { AdminFurnitureDetail, AdminFurnitureDetailInput, AdminFurnitureModel, FurnitureAdminCatalog } from "../../domain/furnitureAdmin";

export type AdminFurnitureDetailRecord = components["schemas"]["AdminFurnitureDetail"];
export type AdminFurnitureDetailListRecord = components["schemas"]["AdminFurnitureDetailList"];
export type AdminFurnitureDetailInputRecord = components["schemas"]["AdminFurnitureDetailInput"];
export type AdminFurnitureModelRecord = components["schemas"]["AdminFurnitureModel"];
export type AdminFurnitureModelInputRecord = components["schemas"]["AdminFurnitureModelInput"];

export function toAdminFurnitureDetail(record: AdminFurnitureDetailRecord): AdminFurnitureDetail {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    category: record.category,
    slot: record.slot,
    modelKey: record.model_key,
    symbolicColor: record.symbolic_color,
    colorMaterials: record.color_materials,
    colorName: record.color_name,
    size: record.size,
    price: record.price,
    shop: record.shop,
    url: record.url,
    imageUrl: record.image_url,
    themes: record.themes,
    position: record.position,
    enabled: record.enabled,
    checkedAt: record.checked_at ? new Date(record.checked_at) : null,
  };
}

export function toFurnitureAdminCatalog(record: AdminFurnitureDetailListRecord): FurnitureAdminCatalog {
  return { details: record.details.map(toAdminFurnitureDetail), slots: record.slots, categories: record.categories };
}

export function toAdminFurnitureDetailInputRecord(input: AdminFurnitureDetailInput): AdminFurnitureDetailInputRecord {
  return {
    furniture_detail: {
      name: input.name,
      category: input.category,
      slot: input.slot as NonNullable<AdminFurnitureDetailInputRecord["furniture_detail"]["slot"]>,
      model_key: input.modelKey,
      symbolic_color: input.symbolicColor,
      color_materials: input.colorMaterials,
      color_name: input.colorName,
      size: input.size,
      price: input.price,
      shop: input.shop,
      url: input.url,
      image_url: input.imageUrl,
      themes: input.themes,
      position: input.position,
      enabled: input.enabled,
    },
  };
}

export function toAdminFurnitureModel(record: AdminFurnitureModelRecord): AdminFurnitureModel {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    shape: record.shape,
    variant: record.variant,
    size: record.size,
    colorMaterialKeys: record.color_material_keys,
    objectKey: record.object_key,
    modelUrl: record.model_url,
    enabled: record.enabled,
    detailsCount: record.details_count,
  };
}
