// users のデータ取得。キーを 1 か所に集めておく。
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepositories } from "../../core/repositories";
import { meQueryKey } from "../../core/session";
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
  const { users } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string }) => users.update(id, input),
    onSuccess: async () => {
      // 自分を更新した場合はヘッダの名前も変わる
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: userKeys.all }),
        queryClient.invalidateQueries({ queryKey: meQueryKey }),
      ]);
    },
  });
}

export function useDeleteUser() {
  const { users } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: UserId) => users.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}
