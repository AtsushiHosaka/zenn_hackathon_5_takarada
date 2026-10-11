// 管理画面 (/admin) で扱う商品 (家具の色・寸法・購入リンク) と 3D モデル。寸法はメートル。
export type FurnitureSize = { w: number; h: number; d: number };
export type FurnitureAxis = keyof FurnitureSize;

export type AdminFurnitureDetail = {
  id: number;
  // 安定 ID。初期データ (db/furniture_details.json) の key、管理画面で足した商品は admin:<uuid>
  key: string;
  name: string;
  category: string;
  // 置き場所の枠
  slot: string;
  modelKey: string | null;
  // 代表色 (#rrggbb)
  symbolicColor: string;
  // 部位ごとの色。キーはモデルの colorMaterialKeys
  colorMaterials: Record<string, string>;
  colorName: string | null;
  size: FurnitureSize;
  // 主な素材
  material: string | null;
  price: number;
  shop: string;
  url: string;
  imageUrl: string | null;
  themes: string[];
  // 候補の並び順 (小さいほど先)
  position: number;
  // false なら提案・検索に出さない
  enabled: boolean;
};

export type AdminFurnitureDetailInput = Pick<AdminFurnitureDetail,
  "name" | "category" | "slot" | "symbolicColor" | "colorMaterials" | "colorName" | "size" | "material" | "price" | "shop" | "url" | "imageUrl" | "themes" | "position" | "enabled"
> & { modelKey: string };

export type FurnitureAdminCatalog = {
  details: AdminFurnitureDetail[];
  slots: string[];
  categories: string[];
  // 選べる雰囲気のタグ
  themes: { id: string; name: string }[];
};

export type AdminFurnitureModel = {
  // モデル ID (GLB のファイル名)
  id: string;
  name: string;
  category: string;
  shape: string;
  variant: string | null;
  size: FurnitureSize;
  colorMaterialKeys: string[];
  // このモデルを使う商品の寸法のうち、公開されておらず推定した辺
  estimatedAxes: FurnitureAxis[];
  // バケット内の GLB のパス。モデル ID から決まる
  objectKey: string;
  modelUrl: string | null;
  enabled: boolean;
  detailsCount: number;
};

// AI による 3D モデルの生成 1 回分。running のあいだは数秒おきに取得し直す
export type ModelGenerationStatus = "running" | "succeeded" | "failed" | "adopted" | "rejected";
export type ModelGenerationFile = "front.png" | "side.png" | "model.glb";

export type ModelGeneration = {
  id: number;
  furnitureDetailId: number;
  // 作るモデルの ID。採用すると 3D モデルの ID になる
  modelKey: string;
  status: ModelGenerationStatus;
  errorMessage: string | null;
  // AI が書いた、形の捉え方のメモ
  notes: string | null;
  checks: { name: string; ok: boolean; detail: string }[];
  // 組み立てられたときだけ入る
  stats: { triangles: number; materials: string[]; bytes: number; size: FurnitureSize } | null;
  ai: { model: string; calls: number; seconds: number } | null;
  // 取得できるファイル
  files: ModelGenerationFile[];
  createdAt: Date;
  finishedAt: Date | null;
};
