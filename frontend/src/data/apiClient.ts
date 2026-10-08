// 通信の口は**ここだけ**。他の場所で fetch を呼ばない。
// 失敗は全部 DomainError に畳んでから投げる。
import { DomainError } from "../domain/error";
import type { TokenStore } from "../core/tokenStore";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  // 公開エンドポイント (signup / login) は false
  requiresAuth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ApiClient = {
  send<T>(path: string, options?: RequestOptions): Promise<T>;
  // ログイン系はトークンがレスポンスヘッダで返るのでこちら
  sendReceivingToken<T>(path: string, options?: RequestOptions): Promise<{ data: T; token: string }>;
  // 署名付きURLへ直接PUTする (部屋写真はAPIを経由せずGCSへ送る)
  sendToSignedUrl(url: string, file: File, signal?: AbortSignal): Promise<void>;
};

export function createApiClient(baseUrl: string, tokenStore: TokenStore): ApiClient {
  async function call(path: string, options: RequestOptions): Promise<{ response: Response; signal: AbortSignal }> {
    const { method = "GET", body, requiresAuth = true, signal, timeoutMs = 30_000 } = options;
    const headers = new Headers({ Accept: "application/json" });
    const isMultipart = body instanceof FormData;
    if (body !== undefined && !isMultipart) headers.set("Content-Type", "application/json");

    const requestToken = requiresAuth ? tokenStore.load() : null;
    if (requiresAuth) {
      if (!requestToken) throw new DomainError("ログインが必要です", 401);
      headers.set("Authorization", requestToken);
    }

    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await fetch(new URL(path, `${baseUrl.replace(/\/$/, "")}/`), {
        method,
        headers,
        body: body === undefined ? undefined : isMultipart ? body : JSON.stringify(body),
        signal: requestSignal,
      });
    } catch (error) {
      throw requestInterruption(error, requestSignal) ?? new DomainError(`サーバーに接続できません (${baseUrl})`);
    }

    if (!response.ok) {
      // 公開ログインの認証失敗や、以前のトークンへの遅い 401 は現在のログインを消さない。
      if (response.status === 401 && requiresAuth && requestToken !== null) tokenStore.clear(requestToken);
      throw new DomainError(await errorMessage(response, requestSignal), response.status);
    }
    return { response, signal: requestSignal };
  }

  async function decode<T>(response: Response, signal: AbortSignal): Promise<T> {
    // 204 No Content (logout / delete)
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw requestInterruption(error, signal) ?? new DomainError("レスポンスを解釈できませんでした");
    }
  }

  return {
    async send<T>(path: string, options: RequestOptions = {}) {
      const { response, signal } = await call(path, options);
      return decode<T>(response, signal);
    },

    // baseUrlもAuthorizationも付けない。署名したContent-Type以外のヘッダを足すと
    // 署名と食い違ってGCSが403を返す (Content-Lengthはブラウザが本体から付ける)
    async sendToSignedUrl(url: string, file: File, signal?: AbortSignal) {
      const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000);
      let response: Response;
      try {
        response = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file, signal: requestSignal });
      } catch (error) {
        throw requestInterruption(error, requestSignal) ?? new DomainError(`${file.name}を送信できませんでした。通信またはブラウザの接続制限が原因の可能性があります。接続を確認して再度お試しください。`);
      }
      if (!response.ok) {
        const reason = response.status === 413 ? "送信先の容量制限で拒否されました。画像を小さくしてから再度お試しください。"
          : response.status === 403 ? "送信先でアクセスを拒否されました。時間を置かずに再度お試しください。"
          : response.status === 422 ? "送信した画像の形式または容量が、アップロード申請と一致しません。写真を選び直してください。"
          : response.status >= 500 ? "送信先でエラーが発生しました。少し待ってから再度お試しください。"
          : "送信先に拒否されました。写真を選び直して再度お試しください。";
        throw new DomainError(`${file.name}の送信に失敗しました（HTTP ${response.status}）。${reason}`, response.status);
      }
    },

    async sendReceivingToken<T>(path: string, options: RequestOptions = {}) {
      const { response, signal } = await call(path, options);
      // 同一オリジンならそのまま読める。直接接続では API 側の CORS expose が必要。
      const token = response.headers.get("Authorization");
      if (!token) throw new DomainError("トークンを受け取れませんでした");
      return { data: await decode<T>(response, signal), token };
    },
  };
}

// backend のエラー形は 2 種類: { error: "..." } と { errors: ["...", ...] }
async function errorMessage(response: Response, signal: AbortSignal): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const { error, errors } = body as { error?: unknown; errors?: unknown };
      if (typeof error === "string") return error;
      if (Array.isArray(errors)) return errors.join("\n");
    }
  } catch (error) {
    const interrupted = requestInterruption(error, signal);
    if (interrupted) throw interrupted;
    // JSON でない (502 など) ならステータスだけ返す
  }
  return `リクエストが失敗しました (${response.status})`;
}

function requestInterruption(error: unknown, signal: AbortSignal): DomainError | undefined {
  if ((signal.reason instanceof DOMException && signal.reason.name === "TimeoutError") || (error instanceof DOMException && error.name === "TimeoutError")) return new DomainError("サーバーの応答が時間内にありませんでした。少し待ってから再度お試しください");
  if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return new DomainError("操作をキャンセルしました");
  return undefined;
}
