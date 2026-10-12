import type { ApiClient } from "../apiClient";
import type { FurnitureAdminRepository } from "../../domain/furnitureAdminRepository";
import {
  toAdminFurnitureDetail, toAdminFurnitureDetailInputRecord, toAdminFurnitureModel, toFurnitureAdminCatalog, toModelGeneration,
  type AdminFurnitureDetailListRecord, type AdminFurnitureDetailRecord, type AdminFurnitureModelInputRecord, type AdminFurnitureModelRecord, type AdminModelGenerationRecord,
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

    async removeDetail(id) {
      await api.send<void>(`/api/v1/admin/furniture_details/${id}`, { method: "DELETE" });
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

    async listModelGenerations(detailId) {
      const records = await api.send<AdminModelGenerationRecord[]>(`/api/v1/admin/furniture_details/${detailId}/model_generations`);
      return records.map(toModelGeneration);
    },

    async startModelGeneration(detailId) {
      return toModelGeneration(await api.send<AdminModelGenerationRecord>(`/api/v1/admin/furniture_details/${detailId}/model_generations`, { method: "POST" }));
    },

    async adoptModelGeneration(id) {
      return toModelGeneration(await api.send<AdminModelGenerationRecord>(`/api/v1/admin/model_generations/${id}/adopt`, { method: "POST" }));
    },

    async rejectModelGeneration(id) {
      return toModelGeneration(await api.send<AdminModelGenerationRecord>(`/api/v1/admin/model_generations/${id}/reject`, { method: "POST" }));
    },

    async modelGenerationFile(id, name) {
      return api.sendForBlob(`/api/v1/admin/model_generations/${id}/files/${name}`);
    },
  };
}
