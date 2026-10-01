// レスポンスの形は OpenAPI の生成物をそのまま使う (`npm run types` で更新)。
// snake_case / iso8601 をここで Domain の綴りに直す。
import type { components } from "../generated/api";
import type { User } from "../../domain/user";

export type UserRecord = components["schemas"]["User"];

export function toUser(record: UserRecord): User {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    createdAt: new Date(record.created_at),
    updatedAt: new Date(record.updated_at),
  };
}
