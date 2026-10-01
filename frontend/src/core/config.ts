// 環境依存の値は **ここだけ**で読む。コードに URL を直書きしない。
// 追加したら frontend/.env.example と src/vite-env.d.ts にも足す。
export const appConfig = {
  // 空文字も未設定として扱う (compose が空の環境変数を渡してくることがある)
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT || "http://localhost:3000",
  // 既定の接続先。未指定なら dev はダミー / build は API
  defaultConnection: import.meta.env.VITE_CONNECTION || (import.meta.env.DEV ? "dummy" : "api"),
} as const;
