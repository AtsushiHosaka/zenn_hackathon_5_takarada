// **DI の登録はこのファイルだけ**。接続先 (ダミー / API) の出し分けもここで閉じる。
// 画面は core/repositories の useRepositories() 経由で protocol だけを見る。
import { appConfig } from "../core/config";
import type { Connection } from "../core/connection";
import { createTokenStore } from "../core/tokenStore";
import type { Repositories } from "../core/repositories";
import { createApiClient } from "../data/apiClient";
import { createApiAuthRepository } from "../data/repositories/apiAuthRepository";
import { createApiUserRepository } from "../data/repositories/apiUserRepository";
import { createApiRoomRepository } from "../data/repositories/apiRoomRepository";
import { createApiCoordinationRepository } from "../data/repositories/apiCoordinationRepository";
import { createDummyAuthRepository } from "../data/dummy/dummyAuthRepository";
import { createDummyUserRepository } from "../data/dummy/dummyUserRepository";
import {
  createDummyCoordinationRepository,
  createDummyRoomRepository,
} from "../data/dummy/dummyCoordinationRepositories";

export function createRepositories(connection: Connection): Repositories {
  const tokenStore = createTokenStore(connection);

  if (connection === "dummy") {
    return {
      tokenStore,
      auth: createDummyAuthRepository(tokenStore),
      users: createDummyUserRepository(tokenStore),
      rooms: createDummyRoomRepository(),
      coordinations: createDummyCoordinationRepository(),
    };
  }

  const api = createApiClient(appConfig.apiEndpoint, tokenStore);
  return {
    tokenStore,
    auth: createApiAuthRepository(api),
    users: createApiUserRepository(api),
    rooms: createApiRoomRepository(api),
    coordinations: createApiCoordinationRepository(api),
  };
}
