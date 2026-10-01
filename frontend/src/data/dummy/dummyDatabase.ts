// メモリ上のダミー DB。リロードすると初期状態に戻る。
// **パスワードは検証しない** (dummyUsers のメールアドレスなら誰でもログインできる)。
import { DomainError } from "../../domain/error";
import type { User, UserId } from "../../domain/user";
import { dummyUsers } from "./dummyData";

// ログイン後のリロードでも本人が分かるように、トークンにメールアドレスを埋めておく
const TOKEN_PREFIX = "Bearer dummy.";

class DummyDatabase {
  private users: User[] = dummyUsers.map((user) => ({ ...user }));
  private nextId: UserId = Math.max(...dummyUsers.map((u) => u.id)) + 1;

  list(): User[] {
    return this.users.map((user) => ({ ...user }));
  }

  find(id: UserId): User {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new DomainError("ユーザーが見つかりません", 404);
    return { ...user };
  }

  findByEmail(email: string): User {
    const normalized = email.trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === normalized);
    if (!user) throw new DomainError("メールアドレスまたはパスワードが違います", 401);
    return { ...user };
  }

  create(input: { name: string; email: string }): User {
    const normalized = input.email.trim().toLowerCase();
    if (this.users.some((u) => u.email.toLowerCase() === normalized)) {
      throw new DomainError("Email has already been taken", 422);
    }
    const now = new Date();
    const user: User = { id: this.nextId++, name: input.name, email: normalized, createdAt: now, updatedAt: now };
    this.users.push(user);
    return { ...user };
  }

  update(id: UserId, input: { name: string }): User {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new DomainError("ユーザーが見つかりません", 404);
    user.name = input.name;
    user.updatedAt = new Date();
    return { ...user };
  }

  remove(id: UserId): void {
    const index = this.users.findIndex((u) => u.id === id);
    if (index < 0) throw new DomainError("ユーザーが見つかりません", 404);
    this.users.splice(index, 1);
  }

  tokenFor(user: User): string {
    return `${TOKEN_PREFIX}${user.email}`;
  }

  userOf(token: string | null): User {
    if (!token?.startsWith(TOKEN_PREFIX)) throw new DomainError("ログインが必要です", 401);
    return this.findByEmail(token.slice(TOKEN_PREFIX.length));
  }
}

export const dummyDatabase = new DummyDatabase();

// ローディング表示を作り込めるよう、少しだけ待たせる
export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 200));
