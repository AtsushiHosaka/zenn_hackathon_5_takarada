import type { FurnitureModelRepository } from "../../domain/furnitureModelRepository";
import type { ApiClient } from "../apiClient";
import { toFurnitureModel, type FurnitureModelRecord } from "../records/furnitureModel";

export function createApiFurnitureModelRepository(api: ApiClient): FurnitureModelRepository {
  return {
    async list() {
      const records = await api.send<FurnitureModelRecord[]>("/api/v1/furniture_models", { requiresAuth: false });
      return records.map(toFurnitureModel);
    },
  };
}
