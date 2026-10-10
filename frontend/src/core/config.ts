// 環境依存の値は **ここだけ**で読む。コードに URL を直書きしない。
// 追加したら frontend/.env.example と src/vite-env.d.ts にも足す。
const configuredRoomContract = import.meta.env.VITE_ROOM_API_CONTRACT;
const roomContract = configuredRoomContract === "analysis" || configuredRoomContract === "legacy" ? configuredRoomContract : "coordination";

function documentUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  if (value.includes('\\') || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return undefined;
  // Configure URI-encoded paths and punycode hosts, matching the API validator.
  if (!/^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(value.trim()) || /%(?![0-9a-f]{2})/i.test(value.trim())) return undefined;
  const absolute = /^https:\/\//i.test(value.trim());
  if (!absolute && !/^\/(?!\/)/.test(value.trim())) return undefined;
  try {
    const url = new URL(value.trim(), window.location.origin);
    if (url.username || url.password) return undefined;
    if (absolute) return url.protocol === "https:" ? url.href : undefined;
    return url.origin === window.location.origin && ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export const appConfig = {
  isDevelopment: import.meta.env.DEV,
  legal: {
    termsUrl: documentUrl(import.meta.env.VITE_TERMS_URL),
    privacyUrl: documentUrl(import.meta.env.VITE_PRIVACY_URL),
  },
  // 空文字も未設定として扱う (compose が空の環境変数を渡してくることがある)
  // 同一オリジンの /api を配信サーバーが GCP へ中継する。
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT || window.location.origin,
  // モックは開発時だけ。開発時は環境変数で API に切り替えられる。
  defaultConnection: import.meta.env.DEV ? import.meta.env.VITE_CONNECTION || "dummy" : "api",
  roomApi: {
    // analysis/coordinationはmainの正式契約。legacyは将来API向けの提案形式。
    contract: roomContract,
    generationPath: import.meta.env.VITE_ROOM_GENERATION_PATH || (roomContract !== "legacy" ? "/api/v1/rooms" : ""),
    jobPath: import.meta.env.VITE_ROOM_JOB_PATH || (roomContract !== "legacy" ? "/api/v1/rooms/{id}" : ""),
    coordinationPath: import.meta.env.VITE_ROOM_COORDINATION_PATH || "/api/v1/rooms/{id}/coordinations",
    coordinationJobPath: import.meta.env.VITE_ROOM_COORDINATION_JOB_PATH || "/api/v1/coordinations/{id}",
    // 写真のアップロード先を発行する。空なら写真を送らずに解析する
    uploadsPath: import.meta.env.VITE_ROOM_UPLOADS_PATH || (roomContract !== "legacy" ? "/api/v1/uploads" : ""),
    requiresAuth: roomContract !== "legacy" || import.meta.env.VITE_ROOM_REQUIRES_AUTH !== "false",
    photoField: import.meta.env.VITE_ROOM_PHOTO_FIELD || "photos[]",
    promptField: import.meta.env.VITE_ROOM_PROMPT_FIELD || "prompt",
    styleField: import.meta.env.VITE_ROOM_STYLE_FIELD || "style",
  },
} as const;
