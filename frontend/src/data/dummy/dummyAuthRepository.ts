import type { AuthRepository } from "../../domain/authRepository";
import type { TokenStore } from "../../core/tokenStore";
import { dummyDatabase, tick } from "./dummyDatabase";

export function createDummyAuthRepository(tokenStore: TokenStore): AuthRepository {
  return {
    async login({ email, password }) {
      await tick();
      const user = await dummyDatabase.authenticate(email, password);
      return { user, token: dummyDatabase.tokenFor(user) };
    },

    async signup({ name, email, password }) {
      await tick();
      const user = await dummyDatabase.create({ name, email, password });
      return { user, token: dummyDatabase.tokenFor(user) };
    },

    async logout() {
      await tick();
    },

    async me() {
      await tick();
      return dummyDatabase.userOf(tokenStore.load());
    },
  };
}
