/// <reference types="vite/client" />

// 環境変数を増やしたら、ここと frontend/.env.example と core/config.ts に足す。
interface ImportMetaEnv {
  readonly VITE_API_ENDPOINT?: string;
  readonly VITE_CONNECTION?: "dummy" | "api";
  readonly VITE_ROOM_API_CONTRACT?: "analysis" | "coordination" | "legacy";
  readonly VITE_ROOM_COORDINATION_PATH?: string;
  readonly VITE_ROOM_COORDINATION_JOB_PATH?: string;
  readonly VITE_ROOM_GENERATION_PATH?: string;
  readonly VITE_ROOM_JOB_PATH?: string;
  readonly VITE_ROOM_UPLOADS_PATH?: string;
  readonly VITE_ROOM_REQUIRES_AUTH?: string;
  readonly VITE_ROOM_PHOTO_FIELD?: string;
  readonly VITE_ROOM_PROMPT_FIELD?: string;
  readonly VITE_ROOM_STYLE_FIELD?: string;
  readonly VITE_ROOM_BUDGET_FIELD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
