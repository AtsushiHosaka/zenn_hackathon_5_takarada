import type { UserRepository } from "../../domain/userRepository";
import type { TokenStore } from "../../core/tokenStore";
import { dummyDatabase, tick } from "./dummyDatabase";

export function createDummyUserRepository(tokenStore: TokenStore): UserRepository {
  // 実 API と同じように未ログインを 401 で弾く (画面の分岐がダミーでも効くように)
  const requireLogin = () => dummyDatabase.userOf(tokenStore.load());

  return {
    async list() {
      await tick();
      requireLogin();
      return dummyDatabase.list();
    },

    async find(id) {
      await tick();
      requireLogin();
      return dummyDatabase.find(id);
    },

    async update(id, input) {
      await tick();
      requireLogin();
      return dummyDatabase.update(id, input);
    },

    async remove(id) {
      await tick();
      requireLogin();
      dummyDatabase.remove(id);
    },
  };
}
