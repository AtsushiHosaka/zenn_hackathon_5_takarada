// 通信の口は**ここだけ**。他の場所で fetch を呼ばない。
// 失敗は全部 DomainError に畳んでから投げる。
import { DomainError } from "../domain/error";
import type { TokenStore } from "../core/tokenStore";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  // 公開エンドポイント (signup / login) は false
  requiresAuth?: boolean;
};

export type ApiClient = {
  send<T>(path: string, options?: RequestOptions): Promise<T>;
  // ログイン系はトークンがレスポンスヘッダで返るのでこちら
  sendReceivingToken<T>(path: string, options?: RequestOptions): Promise<{ data: T; token: string }>;
};

export function createApiClient(baseUrl: string, tokenStore: TokenStore): ApiClient {
  async function call(path: string, options: RequestOptions): Promise<Response> {
    const { method = "GET", body, requiresAuth = true } = options;
    const headers = new Headers({ Accept: "application/json" });
    if (body !== undefined) headers.set("Content-Type", "application/json");

    if (requiresAuth) {
      const token = tokenStore.load();
      if (!token) throw new DomainError("ログインが必要です", 401);
      headers.set("Authorization", token);
    }

    let response: Response;
    try {
      response = await fetch(new URL(path, baseUrl), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new DomainError(`サーバーに接続できません (${baseUrl})`);
    }

    if (!response.ok) throw new DomainError(await errorMessage(response), response.status);
    return response;
  }

  async function decode<T>(response: Response): Promise<T> {
    // 204 No Content (logout / delete)
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new DomainError("レスポンスを解釈できませんでした");
    }
  }

  return {
    async send<T>(path: string, options: RequestOptions = {}) {
      return decode<T>(await call(path, options));
    },

    async sendReceivingToken<T>(path: string, options: RequestOptions = {}) {
      const response = await call(path, options);
      // CORS でヘッダを読めるのは backend が Authorization を expose しているから
      // (backend/config/initializers/cors.rb)
      const token = response.headers.get("Authorization");
      if (!token) throw new DomainError("トークンを受け取れませんでした");
      return { data: await decode<T>(response), token };
    },
  };
}

// backend のエラー形は 2 種類: { error: "..." } と { errors: ["...", ...] }
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const { error, errors } = body as { error?: unknown; errors?: unknown };
      if (typeof error === "string") return error;
      if (Array.isArray(errors)) return errors.join("\n");
    }
  } catch {
    // JSON でない (502 など) ならステータスだけ返す
  }
  return `リクエストが失敗しました (${response.status})`;
}
