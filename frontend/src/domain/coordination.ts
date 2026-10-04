import type { RoomId } from "./room";
import type { Scene } from "./scene";

export type CoordinationId = number;

export type CoordinationStatus = "pending" | "processing" | "done" | "failed";

// 購入リンク 1 件。marker は afterScene の suggested と対応する
export type CoordinationItem = {
  marker: number;
  itemId: number;
  slot: string;
  category: string;
  name: string;
  price: number;
  shop: "amazon" | "rakuten";
  url: string;
  imageUrl: string | null;
  color: string;
  placementNote: string;
};

export type Coordination = {
  id: CoordinationId;
  roomId: RoomId;
  status: CoordinationStatus;
  prompt: string;
  budget: number;
  keptObjectIds: string[];
  // 以下は status が done になると入る
  title: string | null;
  comment: string | null;
  beforeScene: Scene | null;
  afterScene: Scene | null;
  items: CoordinationItem[];
  totalPrice: number | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type CoordinationInput = {
  prompt: string;
  budget: number;
  // 活かす家具の id。空なら全部活かす
  keptObjectIds: string[];
};
