export type FurnitureModelBinding = {
  kind: "existing" | "product";
  reference: string;
};

// 権利者が求めるクレジットと注意書き。モデルを表示する画面で必ず併記する。
export type FurnitureModelCredit = {
  franchise: string;
  credit: string | null;
  notice: string | null;
  licenseUrl: string | null;
};

export type FurnitureModel = {
  id: string;
  name: string;
  category: string;
  shape: string;
  variant: string | null;
  format: "glb";
  objectKey: string;
  // モデル自体の寸法。部屋シーンの配置寸法とは区別する。
  size: { w: number; h: number; d: number };
  unit: "meter";
  axes: "+Y up, +Z front, origin bottom center";
  triangleCount: number;
  byteSize: number;
  sha256: string;
  materials: string[];
  modelUrl: string | null;
  bindings: FurnitureModelBinding[];
  // 推し活グッズの種別ID。家具はnull。
  goodsType: string | null;
  characters: string[];
  searchTerms: string[];
  credits: FurnitureModelCredit[];
};
