import type { AuthRepository } from "../../domain/authRepository";
import type { TokenStore } from "../../core/tokenStore";
import { dummyDatabase, tick } from "./dummyDatabase";

export function createDummyAuthRepository(tokenStore: TokenStore): AuthRepository {
  return {
    async login({ email }) {
      await tick();
      const user = dummyDatabase.findByEmail(email);
      return { user, token: dummyDatabase.tokenFor(user) };
    },

    async signup({ name, email }) {
      await tick();
      const user = dummyDatabase.create({ name, email });
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
