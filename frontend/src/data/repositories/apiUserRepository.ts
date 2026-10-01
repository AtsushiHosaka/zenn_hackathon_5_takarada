import type { ApiClient } from "../apiClient";
import type { UserRepository } from "../../domain/userRepository";
import type { UserInput } from "../records/requests";
import { toUser, type UserRecord } from "../records/user";

export function createApiUserRepository(api: ApiClient): UserRepository {
  return {
    async list() {
      const records = await api.send<UserRecord[]>("/api/v1/users");
      return records.map(toUser);
    },

    async find(id) {
      return toUser(await api.send<UserRecord>(`/api/v1/users/${id}`));
    },

    async update(id, { name }) {
      const body: UserInput = { user: { name } };
      return toUser(await api.send<UserRecord>(`/api/v1/users/${id}`, { method: "PATCH", body }));
    },

    async remove(id) {
      await api.send<void>(`/api/v1/users/${id}`, { method: "DELETE" });
    },
  };
}
