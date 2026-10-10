import catalogue from './characterThemes.json';
import type { RoomDesign } from './room';

export type CharacterTheme = { id: string; name: string; title: string; instructions: string; motif: string; base: string; secondary: string; accent: string };
export const characterThemes: readonly CharacterTheme[] = catalogue;
// 新しく選べるのは初音ミクだけ。ほかのテーマは保存済みの部屋を表示するために残す。
export const selectableCharacterThemes: readonly CharacterTheme[] = characterThemes.filter(theme => theme.id === "hatsune-miku");
export function characterTheme(value: unknown): CharacterTheme | undefined {
  return typeof value === 'string' ? characterThemes.find(theme => theme.id === value) : undefined;
}
export function applyCharacterTheme(design: RoomDesign, id?: string): RoomDesign {
  const theme = characterTheme(id);
  if (!theme) return design;
  // Explicit room palettes compose independently; theme motifs remain available.
  const selectedPalette = typeof design.roomPaletteId === 'string';
  return {
    ...design, characterThemeId: theme.id, style: 'oshi', title: theme.title,
    description: `${theme.name}をイメージした色とモチーフを表示するモックです。${theme.instructions}写真や希望文の解析、商品の提案は行っていません。`,
    ...(selectedPalette ? {} : { wallColor: theme.base, room: design.room && { ...design.room, floorColor: theme.secondary } }),
  };
}
