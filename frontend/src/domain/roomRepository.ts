import type { RoomDesign, RoomShape, Style } from "./room";

export type GenerateRoomInput = {
  photos: File[];
  prompt: string;
  style: Style;
  budget: number;
  tatami?: number;
  shape?: RoomShape;
  roomId?: string;
};

export type RoomCapabilities = { generation: boolean; coordination: boolean; message: string; input: "dimensions" | "photos" };

export type RoomRepository = {
  demo(style?: Style): RoomDesign;
  generate(input: GenerateRoomInput, signal?: AbortSignal): Promise<RoomDesign>;
  capabilities(): Promise<RoomCapabilities>;
};
