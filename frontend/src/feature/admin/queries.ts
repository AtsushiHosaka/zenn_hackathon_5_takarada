import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepositories } from "../../core/repositories";
import { toDomainError } from "../../domain/error";
import type { AdminFurnitureDetail, AdminFurnitureDetailInput, AdminFurnitureModel, FurnitureAdminCatalog, ModelGenerationFile } from "../../domain/furnitureAdmin";

export const adminKeys = {
  details: ["admin", "furniture_details"] as const,
  models: ["admin", "furniture_models"] as const,
  generations: (detailId: number) => ["admin", "model_generations", detailId] as const,
  generationFile: (id: number, name: ModelGenerationFile) => ["admin", "model_generation_file", id, name] as const,
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

// 生成中のものがあるあいだは 5 秒おきに取り直す (取得のたびにサーバーがジョブの結果を取り込む)
export function useModelGenerations(detailId: number) {
  const { furnitureAdmin } = useRepositories();
  return useQuery({
    queryKey: adminKeys.generations(detailId),
    queryFn: () => furnitureAdmin.listModelGenerations(detailId),
    refetchInterval: (query) => query.state.data?.some((generation) => generation.status === "running") ? 5000 : false,
  });
}

export function useStartModelGeneration(detailId: number) {
  const { furnitureAdmin } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => furnitureAdmin.startModelGeneration(detailId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.generations(detailId) }),
  });
}

// 採用すると商品の 3D モデルと部位ごとの色が変わるので、商品とモデルの一覧も取り直す
export function useDecideModelGeneration(detailId: number) {
  const { furnitureAdmin } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adopt }: { id: number; adopt: boolean }) => adopt ? furnitureAdmin.adoptModelGeneration(id) : furnitureAdmin.rejectModelGeneration(id),
    onSuccess: (_result, { adopt }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.generations(detailId) }),
      ...(adopt ? [queryClient.invalidateQueries({ queryKey: adminKeys.details }), queryClient.invalidateQueries({ queryKey: adminKeys.models })] : []),
    ]),
  });
}

// 確認用の画像・GLB。認証つきで受け取った中身を、その場かぎりの URL にして使う側へ渡す
export function useModelGenerationFile(id: number, name: ModelGenerationFile, enabled: boolean) {
  const { furnitureAdmin } = useRepositories();
  return useQuery({
    queryKey: adminKeys.generationFile(id, name),
    queryFn: async () => URL.createObjectURL(await furnitureAdmin.modelGenerationFile(id, name)),
    enabled, staleTime: Infinity, gcTime: Infinity,
  });
}
