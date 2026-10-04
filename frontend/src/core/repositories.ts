// DI の受け口。**中身を決めるのは src/app/container.ts だけ**で、
// 画面はここ経由で protocol (= 型) だけを受け取る。
import { createContext, useContext } from "react";
import type { AuthRepository } from "../domain/authRepository";
import type { UserRepository } from "../domain/userRepository";
import type { RoomRepository } from "../domain/roomRepository";
import type { FurnitureModelRepository } from "../domain/furnitureModelRepository";
import type { TokenStore } from "./tokenStore";

export type Repositories = {
  auth: AuthRepository;
  users: UserRepository;
  rooms: RoomRepository;
  furnitureModels: FurnitureModelRepository;
  tokenStore: TokenStore;
};

export const RepositoriesContext = createContext<Repositories | null>(null);

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);
  if (!repositories) throw new Error("RepositoriesContext の外で useRepositories を呼んでいる");
  return repositories;
}
