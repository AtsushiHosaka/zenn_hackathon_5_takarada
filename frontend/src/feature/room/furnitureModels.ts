import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRepositories } from "../../core/repositories";
import type { FurnitureModel, FurnitureModelCredit } from "../../domain/furnitureModel";
import type { RoomDesign, RoomItem } from "../../domain/room";

export const furnitureModelKeys = {
  all: ["furniture-models"] as const,
};

function bindingKey(item: RoomItem): string | undefined {
  if (item.existing) return `existing:${item.id}`;
  return item.productId ? `product:${item.productId}` : undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// 古い保存シーンでも、DBの明示的な対応関係だけからモデルを補う。
// 配置寸法・位置・回転や、シーンがすでに持つURLは変更しない。
export function resolveFurnitureModels(design: RoomDesign, models: FurnitureModel[]): RoomDesign {
  if (design.source !== "api" || models.length === 0) return design;
  const urls = new Map<string, string>();
  for (const model of models) {
    if (!model.modelUrl || !isHttpUrl(model.modelUrl)) continue;
    for (const binding of model.bindings) urls.set(`${binding.kind}:${binding.reference}`, model.modelUrl);
  }
  function resolve(items: RoomItem[]): RoomItem[] {
    let changed = false;
    const resolved = items.map(item => {
      if (item.textureStatus === "unmatched") return item;
      const key = bindingKey(item);
      const modelUrl = !item.modelUrl && key ? urls.get(key) : undefined;
      if (!modelUrl) return item;
      changed = true;
      return { ...item, modelUrl };
    });
    return changed ? resolved : items;
  }
  const items = resolve(design.items);
  const beforeItems = design.before ? resolve(design.before.items) : undefined;
  if (items === design.items && beforeItems === design.before?.items) return design;
  return {
    ...design,
    items,
    before: design.before && beforeItems ? { ...design.before, items: beforeItems } : design.before,
  };
}

export function useRoomFurnitureModels(design: RoomDesign) {
  const { furnitureModels } = useRepositories();
  const usesCompleteModel = Boolean(design.modelUrl) && design.modelKind !== "shell";
  const candidates = usesCompleteModel ? design.before?.items ?? [] : [...design.items, ...(design.before?.items ?? [])];
  const needsModels = design.source === "api" && candidates.some(item => item.textureStatus !== "unmatched" && !item.modelUrl && Boolean(bindingKey(item)));
  const { data, isFetching, isError } = useQuery({
    queryKey: furnitureModelKeys.all,
    queryFn: () => furnitureModels.list(),
    enabled: needsModels,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  // カタログ取得やGLBの読み込みが失敗しても、既存の簡易家具で操作を続ける。
  const resolved = useMemo(() => data ? resolveFurnitureModels(design, data) : design, [design, data]);
  return { design: resolved, loading: needsModels && isFetching, error: needsModels && isError };
}
export function useFurnitureModelsForDesign(design: RoomDesign): RoomDesign {
  return useRoomFurnitureModels(design).design;
}

const noCredits: FurnitureModelCredit[] = [];

// 部屋に置いたモデルの権利表記。カタログのURLと一致したモデルだけを対象にする。
export function useFurnitureModelCredits(modelUrl?: string): FurnitureModelCredit[] {
  const { furnitureModels } = useRepositories();
  const { data } = useQuery({
    queryKey: furnitureModelKeys.all,
    queryFn: () => furnitureModels.list(),
    enabled: Boolean(modelUrl),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return useMemo(() => modelUrl && data?.find(model => model.modelUrl === modelUrl)?.credits || noCredits, [data, modelUrl]);
}
