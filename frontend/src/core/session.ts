import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { DomainError, toDomainError } from "../domain/error";
import type { Authenticated } from "../domain/authRepository";
import type { User } from "../domain/user";
import type { TokenStore } from "./tokenStore";
import { useRepositories } from "./repositories";

export const meQueryKey = ["me"] as const;
export const sessionQueryKey = (token: string | null) => [...meQueryKey, token] as const;

export type SessionState =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: User }
  | { status: "guest"; user: null }
  | { status: "error"; user: null; error: DomainError; retry: () => void };

type ActionTracker = { action: number; generation: number };
type SessionAction = { id: number; generation: number; token: string | null };
const actions = new WeakMap<TokenStore, ActionTracker>();
const cacheTokens = new WeakMap<QueryClient, WeakMap<TokenStore, string | null>>();

function trackerFor(tokenStore: TokenStore): ActionTracker {
  let tracker = actions.get(tokenStore);
  if (!tracker) {
    tracker = { action: 0, generation: 0 };
    actions.set(tokenStore, tracker);
    const tracked = tracker;
    tokenStore.subscribe(() => { tracked.generation += 1; });
  }
  return tracker;
}

function beginAction(tokenStore: TokenStore): SessionAction {
  const tracker = trackerFor(tokenStore);
  return { id: ++tracker.action, generation: tracker.generation, token: tokenStore.load() };
}

function isCurrentAction(tokenStore: TokenStore, action: SessionAction): boolean {
  const tracker = trackerFor(tokenStore);
  return tracker.action === action.id && tracker.generation === action.generation && tokenStore.load() === action.token;
}

function clearSessionQueries(queryClient: QueryClient): void {
  // 進行中の旧アカウントの取得も止め、次のアカウントへキャッシュを渡さない。
  void queryClient.cancelQueries();
  queryClient.getQueryCache().getAll().forEach((query) => query.reset());
  queryClient.removeQueries();
}

function synchronizeToken(tokenStore: TokenStore, queryClient: QueryClient): void {
  let tokens = cacheTokens.get(queryClient);
  if (!tokens) {
    tokens = new WeakMap();
    cacheTokens.set(queryClient, tokens);
  }
  const token = tokenStore.load();
  if (tokens.has(tokenStore) && tokens.get(tokenStore) !== token) clearSessionQueries(queryClient);
  tokens.set(tokenStore, token);
}

export function useSession(): SessionState {
  const { auth, tokenStore } = useRepositories();
  const queryClient = useQueryClient();
  const subscribe = useCallback((listener: () => void) => {
    trackerFor(tokenStore);
    synchronizeToken(tokenStore, queryClient);
    return tokenStore.subscribe(() => {
      synchronizeToken(tokenStore, queryClient);
      listener();
    });
  }, [tokenStore, queryClient]);
  const token = useSyncExternalStore(subscribe, tokenStore.load);

  const me = useQuery({
    queryKey: sessionQueryKey(token),
    queryFn: async () => {
      const user = await auth.me();
      if (tokenStore.load() !== token) throw new DomainError("ログイン状態が変わりました");
      return user;
    },
    enabled: token !== null,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const isRejected = me.error instanceof DomainError && me.error.isUnauthorized;
  useEffect(() => {
    if (isRejected && token !== null) tokenStore.clear(token);
  }, [isRejected, token, tokenStore]);

  if (!token || isRejected) return { status: "guest", user: null };
  if (me.isError) return {
    status: "error",
    user: null,
    error: toDomainError(me.error),
    retry: () => { void me.refetch(); },
  };
  if (me.data) return { status: "authenticated", user: me.data };
  return { status: "loading", user: null };
}

function completeAuthentication(
  tokenStore: TokenStore,
  queryClient: QueryClient,
  result: Authenticated & { action: SessionAction },
): void {
  if (!isCurrentAction(tokenStore, result.action) || !tokenStore.save(result.token, result.action.token)) return;
  clearSessionQueries(queryClient);
  queryClient.setQueryData(sessionQueryKey(result.token), result.user);
}

export function useLogin() {
  const { auth, tokenStore } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const action = beginAction(tokenStore);
      return { ...await auth.login(input), action };
    },
    onSuccess: (result) => completeAuthentication(tokenStore, queryClient, result),
  });
}

export function useSignup() {
  const { auth, tokenStore } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email: string; password: string }) => {
      const action = beginAction(tokenStore);
      return { ...await auth.signup(input), action };
    },
    onSuccess: (result) => completeAuthentication(tokenStore, queryClient, result),
  });
}

export function useLogout() {
  const { auth, tokenStore } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const action = beginAction(tokenStore);
      try {
        await auth.logout();
      } finally {
        // 失効の通信に失敗しても端末からは消す。後続のログインは消さない。
        if (isCurrentAction(tokenStore, action) && tokenStore.clear(action.token)) clearSessionQueries(queryClient);
      }
    },
  });
}
