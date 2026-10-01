// JWT の置き場。接続先ごとに別のキーへ持つので、切り替えても混ざらない。
//
// **localStorage を直接読むだけでは React が再描画しない**ので、購読できる形にしてある
// (useSyncExternalStore から使う)。保存・破棄はここを必ず通す。
//
// localStorage は XSS でそのまま読める。ハッカソンの土台としては割り切っているが、
// 本番に持っていくなら httpOnly Cookie + CSRF 対策へ寄せる。
import type { Connection } from "./connection";

export type TokenStore = {
  load(): string | null;
  save(token: string): void;
  clear(): void;
  // useSyncExternalStore が使う
  subscribe(listener: () => void): () => void;
};

export function createTokenStore(connection: Connection): TokenStore {
  const key = `hack.token.${connection}`;
  const listeners = new Set<() => void>();
  let current = localStorage.getItem(key);

  const set = (token: string | null) => {
    if (current === token) return;
    current = token;
    if (token === null) localStorage.removeItem(key);
    else localStorage.setItem(key, token);
    listeners.forEach((listener) => listener());
  };

  // 別タブでのログイン / ログアウトにも追従する
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== key) return;
    const next = localStorage.getItem(key);
    if (current === next) return;
    current = next;
    listeners.forEach((listener) => listener());
  });

  return {
    load: () => current,
    save: (token) => set(token),
    clear: () => set(null),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
