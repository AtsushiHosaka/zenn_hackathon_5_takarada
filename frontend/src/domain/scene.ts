// 部屋のシーン (部屋の外形 + 置くもの)。座標系は backend の Swagger (Scene) と同じ:
// 単位はメートル。y が上、原点は北西の床の角、x は東、z は南。position は物体の底面中心。
// rotationY は 0/90/180/270 で、正面 (ローカル +z) が南/東/北/西を向く (three.js の rotation.y と同じ)。

export type Size = { w: number; h: number; d: number };
export type Position = { x: number; y: number; z: number };
export type Wall = "north" | "south" | "east" | "west";

export type RoomWindow = {
  id: string;
  wall: Wall;
  // 壁に沿った中心位置 (north/south は x、east/west は z)
  center: number;
  width: number;
  bottom: number;
  height: number;
};

export type RoomOutline = {
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  floorColor: string;
  windows: RoomWindow[];
};

export type SceneObject = {
  id: string;
  // existing: 今ある家具 / suggested: AI の追加提案
  source: "existing" | "suggested";
  category: string;
  label: string;
  size: Size;
  position: Position;
  rotationY: number;
  color: string;
  // null なら size の箱で描く
  modelUrl: string | null;
  slot: string | null;
  attachTo: string | null;
  itemId: number | null;
  marker: number | null;
};

export type Scene = {
  room: RoomOutline;
  objects: SceneObject[];
};
