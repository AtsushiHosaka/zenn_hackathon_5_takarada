import type { ApiClient } from "../apiClient";
import type { FurnitureAdminRepository } from "../../domain/furnitureAdminRepository";
import {
  toAdminFurnitureDetail, toAdminFurnitureDetailInputRecord, toAdminFurnitureModel, toFurnitureAdminCatalog,
  type AdminFurnitureDetailListRecord, type AdminFurnitureDetailRecord, type AdminFurnitureModelInputRecord, type AdminFurnitureModelRecord,
} from "../records/furnitureAdmin";

export function createApiFurnitureAdminRepository(api: ApiClient): FurnitureAdminRepository {
  return {
    async listDetails() {
      return toFurnitureAdminCatalog(await api.send<AdminFurnitureDetailListRecord>("/api/v1/admin/furniture_details"));
    },

    async createDetail(input) {
      const body = toAdminFurnitureDetailInputRecord(input);
      return toAdminFurnitureDetail(await api.send<AdminFurnitureDetailRecord>("/api/v1/admin/furniture_details", { method: "POST", body }));
    },

    async updateDetail(id, input) {
      const body = toAdminFurnitureDetailInputRecord(input);
      return toAdminFurnitureDetail(await api.send<AdminFurnitureDetailRecord>(`/api/v1/admin/furniture_details/${id}`, { method: "PATCH", body }));
    },

    async exportDetails() {
      return api.send<unknown>("/api/v1/admin/furniture_details/export");
    },

    async listModels() {
      const records = await api.send<AdminFurnitureModelRecord[]>("/api/v1/admin/furniture_models");
      return records.map(toAdminFurnitureModel);
    },

    async setModelEnabled(id, enabled) {
      const body: AdminFurnitureModelInputRecord = { furniture_model: { enabled } };
      return toAdminFurnitureModel(await api.send<AdminFurnitureModelRecord>(`/api/v1/admin/furniture_models/${encodeURIComponent(id)}`, { method: "PATCH", body }));
    },
  };
}
