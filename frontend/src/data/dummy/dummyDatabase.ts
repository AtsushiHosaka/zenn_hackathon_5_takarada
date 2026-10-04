// デモ専用 DB。同じタブの sessionStorage に保存し、リロード後も変更を復元する。
// 実 API の認証基盤ではない。パスワードは SHA-256 の値だけを保存する。
import { DomainError } from "../../domain/error";
import type { User, UserId } from "../../domain/user";
import { dummyUsers } from "./dummyData";

const TOKEN_PREFIX = "Bearer dummy.";
const STORAGE_KEY = "hack.dummy.database.v1";
// 初期ユーザーのパスワードは全員 password。
const INITIAL_PASSWORD_DIGEST = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";

type DummyUser = User & { passwordDigest: string };
type StoredUser = Omit<DummyUser, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === "number" && Number.isSafeInteger(user.id) && user.id > 0
    && typeof user.name === "string" && typeof user.email === "string"
    && typeof user.passwordDigest === "string" && /^[a-f0-9]{64}$/.test(user.passwordDigest)
    && typeof user.createdAt === "string" && !Number.isNaN(Date.parse(user.createdAt))
    && typeof user.updatedAt === "string" && !Number.isNaN(Date.parse(user.updatedAt));
}

function publicUser(user: DummyUser): User {
  return {
    id: user.id, name: user.name, email: user.email,
    createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt),
  };
}

function validateName(name: string): void {
  if (!name.trim()) throw new DomainError("名前を入力してください", 422);
  if ([...name].length > 50) throw new DomainError("名前は50文字以内で入力してください", 422);
}

async function digestPassword(password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new DomainError("ダミーの認証には HTTPS または localhost でアクセスしてください");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

class DummyDatabase {
  private users: DummyUser[] = dummyUsers.map((user) => ({ ...user, passwordDigest: INITIAL_PASSWORD_DIGEST }));
  private nextId: UserId = Math.max(...dummyUsers.map((user) => user.id)) + 1;

  constructor() {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
      if (typeof saved !== "object" || saved === null) return;
      const state = saved as Record<string, unknown>;
      if (!Array.isArray(state.users) || !state.users.every(isStoredUser)
        || typeof state.nextId !== "number" || !Number.isSafeInteger(state.nextId)
        || state.nextId <= Math.max(0, ...state.users.map((user) => user.id))) return;
      this.users = state.users.map((user) => ({
        ...user, createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt),
      }));
      this.nextId = state.nextId;
    } catch {
      // 保存データを読めない場合は初期データを使う。
    }
  }

  private commit(users: DummyUser[], nextId = this.nextId): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ users, nextId }));
    } catch {
      throw new DomainError("ダミーデータを保存できません。ブラウザの保存設定を確認してください");
    }
    this.users = users;
    this.nextId = nextId;
  }

  list(): User[] {
    return this.users.map(publicUser);
  }

  find(id: UserId): User {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user) throw new DomainError("ユーザーが見つかりません", 404);
    return publicUser(user);
  }

  findByEmail(email: string): User {
    const normalized = email.trim().toLowerCase();
    const user = this.users.find((candidate) => candidate.email.toLowerCase() === normalized);
    if (!user) throw new DomainError("メールアドレスまたはパスワードが違います", 401);
    return publicUser(user);
  }

  async authenticate(email: string, password: string): Promise<User> {
    const normalized = email.trim().toLowerCase();
    const passwordDigest = await digestPassword(password);
    const user = this.users.find((candidate) => candidate.email.toLowerCase() === normalized
      && candidate.passwordDigest === passwordDigest);
    if (!user) throw new DomainError("メールアドレスまたはパスワードが違います", 401);
    return publicUser(user);
  }

  async create(input: { name: string; email: string; password: string }): Promise<User> {
    validateName(input.name);
    const normalized = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(normalized)) {
      throw new DomainError("メールアドレスの形式を確認してください", 422);
    }
    const passwordLength = [...input.password].length;
    if (passwordLength < 8 || passwordLength > 128) {
      throw new DomainError("パスワードは8〜128文字で入力してください", 422);
    }
    const passwordDigest = await digestPassword(input.password);
    if (this.users.some((user) => user.email.toLowerCase() === normalized)) {
      throw new DomainError("このメールアドレスは登録済みです", 422);
    }
    const now = new Date();
    const user: DummyUser = {
      id: this.nextId, name: input.name, email: normalized, passwordDigest, createdAt: now, updatedAt: now,
    };
    this.commit([...this.users, user], this.nextId + 1);
    return publicUser(user);
  }

  update(id: UserId, input: { name: string }): User {
    const existing = this.users.find((user) => user.id === id);
    if (!existing) throw new DomainError("ユーザーが見つかりません", 404);
    validateName(input.name);
    const user = { ...existing, name: input.name, updatedAt: new Date() };
    this.commit(this.users.map((candidate) => candidate.id === id ? user : candidate));
    return publicUser(user);
  }

  remove(id: UserId): void {
    if (!this.users.some((user) => user.id === id)) throw new DomainError("ユーザーが見つかりません", 404);
    this.commit(this.users.filter((user) => user.id !== id));
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

// ローディング表示を作り込めるよう、少しだけ待たせる。
export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 200));
