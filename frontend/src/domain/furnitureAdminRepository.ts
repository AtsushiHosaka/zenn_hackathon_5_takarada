import type { AdminFurnitureDetail, AdminFurnitureDetailInput, AdminFurnitureModel, FurnitureAdminCatalog } from "./furnitureAdmin";

export type FurnitureAdminRepository = {
  listDetails(): Promise<FurnitureAdminCatalog>;
  createDetail(input: AdminFurnitureDetailInput): Promise<AdminFurnitureDetail>;
  updateDetail(id: number, input: AdminFurnitureDetailInput): Promise<AdminFurnitureDetail>;
  // db/furniture_details.json にそのまま置ける JSON
  exportDetails(): Promise<unknown>;
  listModels(): Promise<AdminFurnitureModel[]>;
  setModelEnabled(id: string, enabled: boolean): Promise<AdminFurnitureModel>;
};
