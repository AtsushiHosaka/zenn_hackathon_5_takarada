// DI の受け口。**中身を決めるのは src/app/container.ts だけ**で、
// 画面はここ経由で protocol (= 型) だけを受け取る。
import { createContext, useContext } from "react";
import type { AuthRepository } from "../domain/authRepository";
import type { CoordinationRepository } from "../domain/coordinationRepository";
import type { RoomRepository } from "../domain/roomRepository";
import type { UserRepository } from "../domain/userRepository";
import type { TokenStore } from "./tokenStore";

export type Repositories = {
  auth: AuthRepository;
  users: UserRepository;
  rooms: RoomRepository;
  coordinations: CoordinationRepository;
  tokenStore: TokenStore;
};

export const RepositoriesContext = createContext<Repositories | null>(null);

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);
  if (!repositories) throw new Error("RepositoriesContext の外で useRepositories を呼んでいる");
  return repositories;
}
