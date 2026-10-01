// 接続先 (ダミー / 実 API) の切り替え。iOS の AppEnvironment と同じ役割。
import { appConfig } from "./config";

export const connections = ["dummy", "api"] as const;
export type Connection = (typeof connections)[number];

const STORAGE_KEY = "hack.connection";

function isConnection(value: string | null): value is Connection {
  return value !== null && (connections as readonly string[]).includes(value);
}

function fallback(): Connection {
  return isConnection(appConfig.defaultConnection) ? appConfig.defaultConnection : "api";
}

export function loadConnection(): Connection {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isConnection(stored) ? stored : fallback();
}

// 切り替えたらリロードする。アプリ全体 (DI・トークン・キャッシュ) を作り直すのが一番安い。
export function saveConnection(connection: Connection): void {
  localStorage.setItem(STORAGE_KEY, connection);
  location.reload();
}

export const connectionLabels: Record<Connection, string> = {
  dummy: "ダミー (端末内)",
  api: "API",
};
