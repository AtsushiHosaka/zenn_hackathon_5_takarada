// ダミー接続の初期データ。**増やしたければここを書き換える**。
// backend/db/seeds.rb と同じ顔ぶれにしてあるので、接続先を切り替えても見た目が変わらない。
import type { User } from "../../domain/user";

const at = (iso: string) => new Date(iso);

export const dummyUsers: User[] = [
  { id: 1, name: "User 1", email: "user1@example.com", createdAt: at("2026-01-01T00:00:00Z"), updatedAt: at("2026-01-01T00:00:00Z") },
  { id: 2, name: "User 2", email: "user2@example.com", createdAt: at("2026-01-02T00:00:00Z"), updatedAt: at("2026-01-02T00:00:00Z") },
  { id: 3, name: "User 3", email: "user3@example.com", createdAt: at("2026-01-03T00:00:00Z"), updatedAt: at("2026-01-03T00:00:00Z") },
];
