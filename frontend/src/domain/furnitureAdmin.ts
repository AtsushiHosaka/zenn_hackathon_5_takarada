// 管理画面 (/admin) で扱う商品 (家具の色・寸法・購入リンク) と 3D モデル。寸法はメートル。
export type FurnitureSize = { w: number; h: number; d: number };

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
  price: number;
  shop: string;
  url: string;
  imageUrl: string | null;
  themes: string[];
  // 候補の並び順 (小さいほど先)
  position: number;
  // false なら提案・検索に出さない
  enabled: boolean;
  checkedAt: Date | null;
};

export type AdminFurnitureDetailInput = Pick<AdminFurnitureDetail,
  "name" | "category" | "slot" | "symbolicColor" | "colorMaterials" | "colorName" | "size" | "price" | "shop" | "url" | "imageUrl" | "themes" | "position" | "enabled"
> & { modelKey: string };

export type FurnitureAdminCatalog = {
  details: AdminFurnitureDetail[];
  slots: string[];
  categories: string[];
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
  // バケット内の GLB のパス。モデル ID から決まる
  objectKey: string;
  modelUrl: string | null;
  enabled: boolean;
  detailsCount: number;
};
