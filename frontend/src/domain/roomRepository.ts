import type { Room, RoomId, RoomInput } from "./room";

export type RoomRepository = {
  // 解析は非同期。作った直後は status: analyzing
  create(input: RoomInput): Promise<Room>;
  find(id: RoomId): Promise<Room>;
};
