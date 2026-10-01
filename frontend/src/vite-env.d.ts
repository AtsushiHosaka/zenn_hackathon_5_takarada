/// <reference types="vite/client" />

// 環境変数を増やしたら、ここと frontend/.env.example と core/config.ts に足す。
interface ImportMetaEnv {
  readonly VITE_API_ENDPOINT?: string;
  readonly VITE_CONNECTION?: "dummy" | "api";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
