// 管理画面のダミー。メモリ上の数件だけを持ち、再読み込みで元に戻る。3D モデルの URL は無いので箱で表示される。
import { DomainError } from "../../domain/error";
import type { AdminFurnitureDetail, AdminFurnitureModel } from "../../domain/furnitureAdmin";
import type { FurnitureAdminRepository } from "../../domain/furnitureAdminRepository";
import type { TokenStore } from "../../core/tokenStore";
import { dummyDatabase, tick } from "./dummyDatabase";

const initialModels: AdminFurnitureModel[] = [
  { id: "chair_dining", name: "ダイニングチェア", category: "chair", shape: "chair_dining", variant: null, size: { w: 0.45, h: 0.8, d: 0.5 }, colorMaterialKeys: ["tint", "wood"], objectKey: "models/furniture/v1/chair_dining.glb", modelUrl: null, enabled: true, detailsCount: 1 },
  { id: "rug_round", name: "ラウンドラグ", category: "rug", shape: "rug_round", variant: null, size: { w: 1.4, h: 0.02, d: 1.4 }, colorMaterialKeys: ["tint"], objectKey: "models/furniture/v1/rug_round.glb", modelUrl: null, enabled: true, detailsCount: 1 },
];

const initialDetails: AdminFurnitureDetail[] = [
  { id: 1, key: "dummy:1", name: "ダミーのチェア ホワイト", category: "chair", slot: "floor", modelKey: "chair_dining", symbolicColor: "#f2efe8", colorMaterials: { tint: "#f2efe8" }, colorName: "ホワイト", size: { w: 0.45, h: 0.8, d: 0.5 }, price: 4990, shop: "ダミーショップ", url: "https://example.com/chair", imageUrl: null, themes: [], position: 0, enabled: true, checkedAt: null },
  { id: 2, key: "dummy:2", name: "ダミーのラグ ラベンダー", category: "rug", slot: "rug", modelKey: "rug_round", symbolicColor: "#b9a3e3", colorMaterials: { tint: "#b9a3e3" }, colorName: null, size: { w: 1.4, h: 0.02, d: 1.4 }, price: 7990, shop: "ダミーショップ", url: "https://example.com/rug", imageUrl: null, themes: ["oshi_purple"], position: 1, enabled: true, checkedAt: null },
];

export function createDummyFurnitureAdminRepository(tokenStore: TokenStore): FurnitureAdminRepository {
  let details = initialDetails;
  let models = initialModels;
  // 実 API と同じように、管理者でなければ 403 で弾く。管理者は backend/db/seeds.rb (手元では user1) に合わせてある
  const requireAdmin = () => {
    if (dummyDatabase.userOf(tokenStore.load()).email !== "user1@example.com") throw new DomainError("管理者だけが使えます", 403);
  };

  return {
    async listDetails() {
      await tick();
      requireAdmin();
      return { details, slots: ["bed_cover", "curtain", "rug", "wall_decor", "light", "display", "cushion", "desk_top", "floor"], categories: ["chair", "rug", "sofa", "table"] };
    },

    async createDetail(input) {
      await tick();
      requireAdmin();
      const id = Math.max(0, ...details.map((detail) => detail.id)) + 1;
      const detail: AdminFurnitureDetail = { ...input, id, key: `dummy:${id}`, checkedAt: null };
      details = [...details, detail];
      return detail;
    },

    async updateDetail(id, input) {
      await tick();
      requireAdmin();
      const existing = details.find((detail) => detail.id === id);
      if (!existing) throw new DomainError("見つかりません", 404);
      const detail = { ...existing, ...input };
      details = details.map((candidate) => candidate.id === id ? detail : candidate);
      return detail;
    },

    async removeDetail(id) {
      await tick();
      requireAdmin();
      if (!details.some((detail) => detail.id === id)) throw new DomainError("見つかりません", 404);
      details = details.filter((detail) => detail.id !== id);
    },

    async exportDetails() {
      await tick();
      requireAdmin();
      return { details: details.filter((detail) => detail.enabled) };
    },

    async listModels() {
      await tick();
      requireAdmin();
      return models;
    },

    async setModelEnabled(id, enabled) {
      await tick();
      requireAdmin();
      const existing = models.find((model) => model.id === id);
      if (!existing) throw new DomainError("見つかりません", 404);
      const model = { ...existing, enabled };
      models = models.map((candidate) => candidate.id === id ? model : candidate);
      return model;
    },
  };
}
