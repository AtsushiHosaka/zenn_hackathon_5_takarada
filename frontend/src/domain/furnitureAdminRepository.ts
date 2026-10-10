import type { AdminFurnitureDetail, AdminFurnitureDetailInput, AdminFurnitureModel, FurnitureAdminCatalog } from "./furnitureAdmin";

export type FurnitureAdminRepository = {
  listDetails(): Promise<FurnitureAdminCatalog>;
  createDetail(input: AdminFurnitureDetailInput): Promise<AdminFurnitureDetail>;
  updateDetail(id: number, input: AdminFurnitureDetailInput): Promise<AdminFurnitureDetail>;
  removeDetail(id: number): Promise<void>;
  // db/furniture_details.json (初期データ) と同じ形の JSON。控えにも使う
  exportDetails(): Promise<unknown>;
  listModels(): Promise<AdminFurnitureModel[]>;
  setModelEnabled(id: string, enabled: boolean): Promise<AdminFurnitureModel>;
};
