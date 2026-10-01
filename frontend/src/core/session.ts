// ログイン状態。`me` クエリのキャッシュが唯一の持ち主なので、Provider は置かない
// (同じキーを見ている画面は TanStack Query が勝手に共有する)。
import { useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DomainError } from "../domain/error";
import type { User } from "../domain/user";
import { useRepositories } from "./repositories";

export const meQueryKey = ["me"] as const;

export type SessionState =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: User }
  | { status: "guest"; user: null };

export function useSession(): SessionState {
  const { auth, tokenStore } = useRepositories();
  const queryClient = useQueryClient();
  // localStorage を直接読むと保存・破棄で再描画されないので、購読して見る
  const hasToken = useSyncExternalStore(tokenStore.subscribe, tokenStore.load) !== null;

  const me = useQuery({
    queryKey: meQueryKey,
    queryFn: () => auth.me(),
    enabled: hasToken,
    retry: false,
    staleTime: Infinity,
  });

  // 期限切れ・失効したトークンを掴み続けない
  const isRejected = me.error instanceof DomainError && me.error.isUnauthorized;
  useEffect(() => {
    if (!isRejected) return;
    tokenStore.clear();
    queryClient.removeQueries({ queryKey: meQueryKey });
  }, [isRejected, tokenStore, queryClient]);

  if (!hasToken || me.isError) return { status: "guest", user: null };
  if (me.data) return { status: "authenticated", user: me.data };
  return { status: "loading", user: null };
}

export function useLogin() {
  const { auth, tokenStore } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; password: string }) => auth.login(input),
    onSuccess: ({ user, token }) => {
      tokenStore.save(token);
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useSignup() {
  const { auth, tokenStore } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) => auth.signup(input),
    onSuccess: ({ user, token }) => {
      tokenStore.save(token);
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useLogout() {
  const { auth, tokenStore } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    // サーバー側で失効に失敗しても、手元のトークンは必ず捨てる
    mutationFn: () => auth.logout().catch(() => undefined),
    onSettled: () => {
      tokenStore.clear();
      queryClient.clear();
    },
  });
}
