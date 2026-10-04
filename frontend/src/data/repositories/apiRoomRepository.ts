import type { ApiClient } from "../apiClient";
import type { RoomRepository } from "../../domain/roomRepository";
import type { RoomInputRecord } from "../records/requests";
import { toRoom, type RoomRecord } from "../records/room";

// rooms はデモ用にログイン不要の公開エンドポイント
export function createApiRoomRepository(api: ApiClient): RoomRepository {
  return {
    async create({ tatami, shape }) {
      const body: RoomInputRecord = { room: { tatami, shape } };
      return toRoom(await api.send<RoomRecord>("/api/v1/rooms", { method: "POST", body, requiresAuth: false }));
    },

    async find(id) {
      return toRoom(await api.send<RoomRecord>(`/api/v1/rooms/${id}`, { requiresAuth: false }));
    },
  };
}
