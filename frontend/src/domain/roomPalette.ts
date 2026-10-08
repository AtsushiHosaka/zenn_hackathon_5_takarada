import catalogue from "./roomPalettes.json";
import type { RoomDesign } from "./room";

export type RoomPalette = { id: string; family: string; name: string; base: string; secondary: string; accent: string };
export const roomPalettes: readonly RoomPalette[] = catalogue;
export const defaultRoomPaletteId = "warm-ivory";
export function roomPalette(id: unknown): RoomPalette | undefined {
  return typeof id === "string" ? roomPalettes.find(palette => palette.id === id) : undefined;
}
export function applyRoomPalette(design: RoomDesign, id: string): RoomDesign {
  const palette = roomPalette(id);
  if (!palette) return design;
  return { ...design, roomPaletteId: id, wallColor: palette.base, room: design.room && { ...design.room, floorColor: palette.secondary } };
}
