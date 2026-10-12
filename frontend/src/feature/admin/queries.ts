import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepositories } from "../../core/repositories";
import { toDomainError } from "../../domain/error";
import type { AdminFurnitureDetail, AdminFurnitureDetailInput, AdminFurnitureModel, FurnitureAdminCatalog } from "../../domain/furnitureAdmin";

export const adminKeys = {
  details: ["admin", "furniture_details"] as const,
  models: ["admin", "furniture_models"] as const,
};

export function useAdminFurnitureDetails() {
  const { furnitureAdmin } = useRepositories();
  return useQuery({ queryKey: adminKeys.details, queryFn: () => furnitureAdmin.listDetails() });
}

export function useAdminFurnitureModels() {
  const { furnitureAdmin } = useRepositories();
  return useQuery({ queryKey: adminKeys.models, queryFn: () => furnitureAdmin.listModels(), retry: (count, error) => toDomainError(error).status !== 403 && count < 1 });
}

// id が null なら新規作成
export function useSaveFurnitureDetail() {
  const { furnitureAdmin } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: AdminFurnitureDetailInput }) =>
      id === null ? furnitureAdmin.createDetail(input) : furnitureAdmin.updateDetail(id, input),
    onSuccess: (saved: AdminFurnitureDetail) => {
      queryClient.setQueryData<FurnitureAdminCatalog>(adminKeys.details, (catalog) => catalog && {
        ...catalog,
        details: catalog.details.some((detail) => detail.id === saved.id)
          ? catalog.details.map((detail) => detail.id === saved.id ? saved : detail)
          : [...catalog.details, saved],
      });
      // モデルごとの商品数が変わる
      void queryClient.invalidateQueries({ queryKey: adminKeys.models });
    },
  });
}

export function useDeleteFurnitureDetail() {
  const { furnitureAdmin } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => furnitureAdmin.removeDetail(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<FurnitureAdminCatalog>(adminKeys.details, (catalog) => catalog && { ...catalog, details: catalog.details.filter((detail) => detail.id !== id) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.models });
    },
  });
}

export function useSetFurnitureModelEnabled() {
  const { furnitureAdmin } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => furnitureAdmin.setModelEnabled(id, enabled),
    onSuccess: (saved: AdminFurnitureModel) => {
      queryClient.setQueryData<AdminFurnitureModel[]>(adminKeys.models, (models) => models?.map((model) => model.id === saved.id ? saved : model));
    },
  });
}

export function useExportFurnitureDetails() {
  const { furnitureAdmin } = useRepositories();
  return useMutation({ mutationFn: () => furnitureAdmin.exportDetails() });
}
