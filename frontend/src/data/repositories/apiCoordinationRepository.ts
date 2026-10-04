import type { ApiClient } from "../apiClient";
import type { CoordinationRepository } from "../../domain/coordinationRepository";
import type { CoordinationInputRecord } from "../records/requests";
import { toCoordination, type CoordinationRecord } from "../records/coordination";

// coordinations はデモ用にログイン不要の公開エンドポイント
export function createApiCoordinationRepository(api: ApiClient): CoordinationRepository {
  return {
    async create(roomId, { prompt, budget, keptObjectIds }) {
      const body: CoordinationInputRecord = {
        coordination: { prompt, budget, kept_object_ids: keptObjectIds },
      };
      const record = await api.send<CoordinationRecord>(`/api/v1/rooms/${roomId}/coordinations`, {
        method: "POST",
        body,
        requiresAuth: false,
      });
      return toCoordination(record);
    },

    async find(id) {
      return toCoordination(await api.send<CoordinationRecord>(`/api/v1/coordinations/${id}`, { requiresAuth: false }));
    },
  };
}
