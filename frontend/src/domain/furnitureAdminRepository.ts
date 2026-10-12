import type { AdminFurnitureDetail, AdminFurnitureDetailInput, AdminFurnitureModel, FurnitureAdminCatalog, ModelGeneration, ModelGenerationFile } from "./furnitureAdmin";

export type FurnitureAdminRepository = {
  listDetails(): Promise<FurnitureAdminCatalog>;
  createDetail(input: AdminFurnitureDetailInput): Promise<AdminFurnitureDetail>;
  updateDetail(id: number, input: AdminFurnitureDetailInput): Promise<AdminFurnitureDetail>;
  removeDetail(id: number): Promise<void>;
  // db/furniture_details.json (初期データ) と同じ形の JSON。控えにも使う
  exportDetails(): Promise<unknown>;
  listModels(): Promise<AdminFurnitureModel[]>;
  setModelEnabled(id: string, enabled: boolean): Promise<AdminFurnitureModel>;
  // AI による 3D モデルの生成。商品ごとに新しい順
  listModelGenerations(detailId: number): Promise<ModelGeneration[]>;
  startModelGeneration(detailId: number): Promise<ModelGeneration>;
  adoptModelGeneration(id: number): Promise<ModelGeneration>;
  rejectModelGeneration(id: number): Promise<ModelGeneration>;
  // 確認用の画像・GLB の中身
  modelGenerationFile(id: number, name: ModelGenerationFile): Promise<Blob>;
};
