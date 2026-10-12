import catalogue from "./roomPalettes.json";
import type { RoomDesign } from "./room";

export type RoomPalette = { id: string; family: string; name: string; base: string; secondary: string; accent: string };
export const roomPalettes: readonly RoomPalette[] = catalogue;
export const defaultRoomPaletteId = "warm-ivory";
// 画面で選べる単色。色ごとに配色を1つ割り当て、APIへは従来どおり配色のidを送る。
export type RoomColor = { paletteId: string; name: string; color: string };
export const roomColors: readonly RoomColor[] = [
  { paletteId: "snow-graphite", name: "ホワイト", color: "#F6F7F8" },
  { paletteId: "stone-gray", name: "グレー", color: "#A7A59E" },
  { paletteId: "warm-ivory", name: "ベージュ", color: "#D3BDA1" },
  { paletteId: "coffee-cream", name: "ブラウン", color: "#A38167" },
  { paletteId: "sage-clay", name: "グリーン", color: "#A9B394" },
  { paletteId: "mint-cloud", name: "ミント", color: "#B6DCCF" },
  { paletteId: "sky-white", name: "ブルー", color: "#ACD2EC" },
  { paletteId: "midnight-brass", name: "ネイビー", color: "#1F2C43" },
  { paletteId: "lavender-milk", name: "パープル", color: "#CAB8E0" },
  { paletteId: "blush-linen", name: "ピンク", color: "#E4B7B2" },
  { paletteId: "brick-cream", name: "レッド", color: "#AC544A" },
  { paletteId: "apricot", name: "オレンジ", color: "#E9B78D" },
  { paletteId: "butter-yellow", name: "イエロー", color: "#E9D389" },
  { paletteId: "charcoal-silver", name: "ブラック", color: "#2C3137" },
];
export function roomColor(paletteId: unknown): RoomColor | undefined {
  return roomColors.find(color => color.paletteId === paletteId);
}
export function roomPalette(id: unknown): RoomPalette | undefined {
  return typeof id === "string" ? roomPalettes.find(palette => palette.id === id) : undefined;
}
export function applyRoomPalette(design: RoomDesign, id: string): RoomDesign {
  const palette = roomPalette(id);
  if (!palette) return design;
  return { ...design, roomPaletteId: id, wallColor: palette.base, room: design.room && { ...design.room, floorColor: palette.secondary } };
}
