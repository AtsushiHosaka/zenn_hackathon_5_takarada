import type { FurnitureModelRepository } from "../../domain/furnitureModelRepository";

export function createDummyFurnitureModelRepository(): FurnitureModelRepository {
  return {
    async list() {
      return [];
    },
  };
}
