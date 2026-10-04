import type { FurnitureModelRepository } from "../../domain/furnitureModelRepository";
import type { ApiClient } from "../apiClient";
import { toFurnitureModel } from "../records/furnitureModel";

export function createApiFurnitureModelRepository(api: ApiClient): FurnitureModelRepository {
  return {
    async list() {
      const records = await api.send<unknown>("/api/v1/furniture_models", { requiresAuth: false });
      if (!Array.isArray(records)) return [];
      return records.flatMap(record => {
        const model = toFurnitureModel(record);
        return model ? [model] : [];
      });
    },
  };
}
