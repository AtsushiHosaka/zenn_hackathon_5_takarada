// **DI の登録はこのファイルだけ**。
// 画面は core/repositories の useRepositories() 経由で protocol だけを見る。
import { appConfig } from "../core/config";
import { createTokenStore } from "../core/tokenStore";
import type { Repositories } from "../core/repositories";
import { createApiClient } from "../data/apiClient";
import { createApiAuthRepository } from "../data/repositories/apiAuthRepository";
import { createApiUserRepository } from "../data/repositories/apiUserRepository";
import { createApiRoomRepository } from "../data/repositories/apiRoomRepository";
import { createApiFurnitureAdminRepository } from "../data/repositories/apiFurnitureAdminRepository";

export function createRepositories(): Repositories {
  const tokenStore = createTokenStore();
  const api = createApiClient(appConfig.apiEndpoint, tokenStore);
  return {
    tokenStore,
    auth: createApiAuthRepository(api),
    users: createApiUserRepository(api),
    rooms: createApiRoomRepository(api, appConfig.roomApi, appConfig.apiEndpoint),
    furnitureAdmin: createApiFurnitureAdminRepository(api),
  };
}
