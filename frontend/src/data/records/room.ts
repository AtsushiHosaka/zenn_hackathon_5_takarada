import type { components } from "../generated/api";
import type { Room } from "../../domain/room";
import { toScene } from "./scene";

export type RoomRecord = components["schemas"]["Room"];

export function toRoom(record: RoomRecord): Room {
  return {
    id: record.id,
    tatami: record.tatami,
    shape: record.shape,
    status: record.status,
    scene: record.scene ? toScene(record.scene) : null,
    errorMessage: record.error_message,
    createdAt: new Date(record.created_at),
  };
}
