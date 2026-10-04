import type { Coordination, CoordinationId, CoordinationInput } from "./coordination";
import type { RoomId } from "./room";

export type CoordinationRepository = {
  // 生成は非同期。作った直後は status: pending
  create(roomId: RoomId, input: CoordinationInput): Promise<Coordination>;
  find(id: CoordinationId): Promise<Coordination>;
};
