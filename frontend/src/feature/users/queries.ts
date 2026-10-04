import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepositories } from "../../core/repositories";
import { sessionQueryKey } from "../../core/session";
import type { UserId } from "../../domain/user";

export const userKeys = {
  all: ["users"] as const,
  detail: (id: UserId) => ["users", id] as const,
};

export function useUsers() {
  const { users } = useRepositories();
  return useQuery({ queryKey: userKeys.all, queryFn: () => users.list() });
}

export function useUser(id: UserId) {
  const { users } = useRepositories();
  return useQuery({ queryKey: userKeys.detail(id), queryFn: () => users.find(id) });
}

export function useUpdateUser(id: UserId) {
  const { users, tokenStore } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => users.update(id, input),
    onMutate: () => tokenStore.load(),
    onSuccess: async (user, _input, token) => {
      if (tokenStore.load() !== token) return;
      await queryClient.cancelQueries({ queryKey: sessionQueryKey(token ?? null) });
      if (tokenStore.load() !== token) return;
      queryClient.setQueryData(userKeys.detail(id), user);
      queryClient.setQueryData(sessionQueryKey(token ?? null), user);
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useDeleteUser() {
  const { users, tokenStore } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: UserId) => users.remove(id),
    onMutate: () => tokenStore.load(),
    onSuccess: (_result, _id, token) => {
      if (tokenStore.load() !== token) return;
      tokenStore.clear(token);
      void queryClient.cancelQueries();
      queryClient.clear();
    },
  });
}
