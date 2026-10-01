import type { User, UserId } from "./user";

export type UserRepository = {
  list(): Promise<User[]>;
  find(id: UserId): Promise<User>;
  update(id: UserId, input: { name: string }): Promise<User>;
  remove(id: UserId): Promise<void>;
};
