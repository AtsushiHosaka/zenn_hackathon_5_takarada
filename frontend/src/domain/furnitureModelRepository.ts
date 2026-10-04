import type { FurnitureModel } from "./furnitureModel";

export type FurnitureModelRepository = {
  list(): Promise<FurnitureModel[]>;
};
