import type { ApiClient } from "../apiClient";
import type { AuthRepository, Authenticated } from "../../domain/authRepository";
import type { LoginInput, SignupInput } from "../records/requests";
import { toUser, type UserRecord } from "../records/user";

export function createApiAuthRepository(api: ApiClient): AuthRepository {
  return {
    async login({ email, password }): Promise<Authenticated> {
      const body: LoginInput = { identity: { email, password } };
      const { data, token } = await api.sendReceivingToken<UserRecord>("/api/v1/login", {
        method: "POST",
        body,
        requiresAuth: false,
      });
      return { user: toUser(data), token };
    },

    async signup({ name, email, password }): Promise<Authenticated> {
      const body: SignupInput = { user: { name, email, password } };
      const { data, token } = await api.sendReceivingToken<UserRecord>("/api/v1/signup", {
        method: "POST",
        body,
        requiresAuth: false,
      });
      return { user: toUser(data), token };
    },

    async logout(): Promise<void> {
      await api.send<void>("/api/v1/logout", { method: "DELETE" });
    },

    async me() {
      return toUser(await api.send<UserRecord>("/api/v1/me"));
    },
  };
}
