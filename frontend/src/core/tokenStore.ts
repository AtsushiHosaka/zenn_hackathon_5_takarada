export type TokenStore = {
  load(): string | null;
  // expectedToken を指定すると、別のログイン状態を上書きしない。
  save(token: string, expectedToken?: string | null): boolean;
  clear(expectedToken?: string | null): boolean;
  subscribe(listener: () => void): () => void;
};

// 既存のログイン状態を保つため、キー名は従来の `hack.token.api` のまま。
const TOKEN_KEY = "hack.token.api";

export function createTokenStore(): TokenStore {
  const key = TOKEN_KEY;
  const listeners = new Set<() => void>();
  let current = localStorage.getItem(key);

  const notify = (token: string | null) => {
    if (current === token) return;
    current = token;
    listeners.forEach((listener) => listener());
  };

  const set = (token: string | null, expectedToken?: string | null): boolean => {
    // storage イベントの配送前でも、別タブの更新を確認する。
    const stored = localStorage.getItem(key);
    if (expectedToken !== undefined && stored !== expectedToken) {
      notify(stored);
      return false;
    }
    if (token === null) localStorage.removeItem(key);
    else localStorage.setItem(key, token);
    notify(token);
    return true;
  };

  window.addEventListener("storage", (event) => {
    if (event.storageArea !== localStorage || (event.key !== null && event.key !== key)) return;
    notify(localStorage.getItem(key));
  });

  return {
    load: () => localStorage.getItem(key),
    save: (token, expectedToken) => set(token, expectedToken),
    clear: (expectedToken) => set(null, expectedToken),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
