import { furnitureSurfaceHeight } from './roomBounds';
import type { RoomDesign, RoomItem } from '../../domain/room';

const EPSILON = 1e-6;
const adornments = new Set(['cover', 'bed_cover', 'rug', 'wall_decor', 'artwork', 'led', 'poster']);
export const isFurnitureAdornment = (item: Pick<RoomItem, 'category'>) => adornments.has(item.category);
const axes = (item: RoomItem) => {
  const angle = (item.rotation ?? 0) * Math.PI / 180;
  return [[Math.cos(angle), -Math.sin(angle)], [Math.sin(angle), Math.cos(angle)]] as const;
};
function projectedRadius(item: RoomItem, axis: readonly number[]) {
  const [x, z] = axes(item);
  return item.size[0] / 2 * Math.abs(x[0] * axis[0] + x[1] * axis[1])
    + item.size[2] / 2 * Math.abs(z[0] * axis[0] + z[1] * axis[1]);
}
function supportedContact(item: RoomItem, support: RoomItem, design: RoomDesign) {
  return item.supportObjectId === support.id && furnitureSurfaceHeight(item, item.position, design) !== null;
}
export function furnitureVolumesOverlap(a: RoomItem, b: RoomItem, design: RoomDesign) {
  if (adornments.has(a.category) || adornments.has(b.category)) return false;
  if ([a, b].some(item => item.size.some(value => !Number.isFinite(value) || value <= 0) || item.position.some(value => !Number.isFinite(value)))) return false;
  if (Math.abs(a.position[1] - b.position[1]) >= (a.size[1] + b.size[1]) / 2 - EPSILON) return false;
  if (supportedContact(a, b, design) || supportedContact(b, a, design)) return false;
  return [...axes(a), ...axes(b)].every(axis => {
    const distance = Math.abs((a.position[0] - b.position[0]) * axis[0] + (a.position[2] - b.position[2]) * axis[1]);
    return distance < projectedRadius(a, axis) + projectedRadius(b, axis) - EPSILON;
  });
}
export function overlappingFurnitureIds(items: RoomItem[], design: RoomDesign, intersects?: (a: RoomItem, b: RoomItem) => boolean): Set<string> {
  const result = new Set<string>();
  const current = { ...design, items };
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (furnitureVolumesOverlap(items[i], items[j], current) && (!intersects || intersects(items[i], items[j]))) { result.add(items[i].id); result.add(items[j].id); }
  }
  return result;
}

export function furnitureOverlapMessage(items: RoomItem[], overlaps: Set<string>, incomplete: Set<string>): string {
  const names = (ids: Set<string>) => {
    const list = items.filter(item => ids.has(item.id));
    const labels = list.slice(0, 3).map(item => item.name.length > 40 ? `${item.name.slice(0, 40)}…` : item.name);
    return labels.join('、') + (list.length > 3 ? `、ほか${list.length - 3}点` : '');
  };
  return [
    overlaps.size ? `家具${overlaps.size}点が重なっています：${names(overlaps)}` : '',
    incomplete.size ? `一部の家具は、重なり判定や赤い輪郭の表示が不完全です：${names(incomplete)}` : '',
  ].filter(Boolean).join('。');
}
