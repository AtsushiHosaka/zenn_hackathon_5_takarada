import type { Scene } from "./scene";

export type RoomId = number;

// 部屋の形。square: 正方形に近い / standard: やや縦長 / long: 細長い
export type RoomShape = "square" | "standard" | "long";

export type RoomStatus = "analyzing" | "ready" | "failed";

export type Room = {
  id: RoomId;
  tatami: number;
  shape: RoomShape;
  status: RoomStatus;
  // status が ready になると入る
  scene: Scene | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type RoomInput = { tatami: number; shape: RoomShape };
