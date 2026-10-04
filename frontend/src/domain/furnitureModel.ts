export type FurnitureModelBinding = {
  kind: "existing" | "product";
  reference: string;
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
};
