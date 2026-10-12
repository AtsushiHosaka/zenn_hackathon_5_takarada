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
        const interrupted = requestInterruption(error, requestSignal);
        const reason = interrupted?.message ?? "アップロード先との通信に失敗しました。ブラウザから詳しい原因を確認できません。通信状況を確認して、もう一度お試しください。";
        throw new DomainError(`「${file.name}」を送信できませんでした。${reason}`, interrupted?.status);
      }
      if (!response.ok) {
        const reason = await uploadErrorMessage(response, requestSignal);
        throw new DomainError(`「${file.name}」を送信できませんでした。${reason}`, response.status);
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

const MAX_UPLOAD_ERROR_BODY_BYTES = 16 * 1024;
const MAX_UPLOAD_ERROR_MESSAGE_CHARS = 500;

async function uploadErrorBody(response: Response): Promise<string | undefined> {
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MAX_UPLOAD_ERROR_BODY_BYTES) {
        await reader.cancel();
        return undefined;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

// GCS returns XML errors; the local storage adapter can return JSON errors.
async function uploadErrorMessage(response: Response, signal: AbortSignal): Promise<string> {
  let code: string | undefined;
  let message: string | undefined;
  try {
    const text = await uploadErrorBody(response);
    if (text === undefined) return uploadStatusMessage(response.status);
    if (response.headers.get("Content-Type")?.includes("json")) {
      const body: unknown = JSON.parse(text);
      if (body && typeof body === "object") {
        const error = (body as { error?: unknown }).error;
        if (typeof error === "string") {
          const confirmed = error.trim();
          message = confirmed.length > MAX_UPLOAD_ERROR_MESSAGE_CHARS
            ? `${confirmed.slice(0, MAX_UPLOAD_ERROR_MESSAGE_CHARS - 1)}…` : confirmed;
        }
      }
    } else {
      const xml = new DOMParser().parseFromString(text, "application/xml");
      if (!xml.querySelector("parsererror")) code = xml.querySelector("Error > Code")?.textContent ?? undefined;
    }
  } catch (error) {
    const interrupted = requestInterruption(error, signal);
    if (interrupted) return interrupted.message;
  }
  const status = `HTTP ${response.status}`;
  if (code && /^[A-Za-z0-9_]{1,80}$/.test(code)) {
    const reasons: Record<string, string> = {
      EntityTooLarge: "アップロード先の容量制限を超えました。",
      AccessDenied: "アップロード先がアクセスを拒否しました。",
      SignatureDoesNotMatch: "アップロード先で送信の署名を確認できませんでした。",
      ExpiredToken: "送信に必要な認証情報の有効期限が切れました。",
      RequestTimeTooSkewed: "送信時刻とアップロード先の時刻が一致しませんでした。",
    };
    return `${reasons[code] ?? "アップロード先からエラーが返されました。"}（${status}・${code}）もう一度お試しください。`;
  }
  if (message) return `${message}（${status}）`;
  return uploadStatusMessage(response.status);
}

function uploadStatusMessage(responseStatus: number): string {
  const status = `HTTP ${responseStatus}`;
  if (responseStatus === 413) return `アップロード先が送信容量を超えたため拒否しました。（${status}）画像の容量を減らしてお試しください。`;
  if (responseStatus === 401 || responseStatus === 403) return `アップロード先が認証またはアクセスを拒否しました。（${status}）もう一度お試しください。`;
  return `アップロード先からエラーが返されました。（${status}）詳しい原因を確認できません。少し待ってから再度お試しください。`;
}
