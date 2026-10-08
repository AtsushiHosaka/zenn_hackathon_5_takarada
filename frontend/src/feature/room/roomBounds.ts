import { isManualFurniture, type RoomDesign, type RoomItem } from '../../domain/room';
import { LAYOUT_GRID_STEP, snapItemPosition, snapToLayoutGrid } from './layoutGrid';

type Vector = [number, number, number];
export type RoomBounds = { min: Vector; max: Vector };

// Bounds of the reference drawing's floor, shared with its renderer.
export const REFERENCE_FLOOR_BOUNDS: RoomBounds = { min: [-2.2, 0, -2.2], max: [2.0008, 0, 2.0008] };

export function getInferredRoomBounds(items: RoomItem[]): RoomBounds {
  const original = items.filter(item => !isManualFurniture(item));
  const min: Vector = original.length ? [Infinity, Infinity, Infinity] : [-2.6, 0, -2.1];
  const max: Vector = original.length ? [-Infinity, -Infinity, -Infinity] : [2.6, 2.7, 2.1];
  for (const item of original) {
    for (const axis of [0, 1, 2] as const) {
      min[axis] = Math.min(min[axis], item.position[axis] - item.size[axis] / 2);
      max[axis] = Math.max(max[axis], item.position[axis] + item.size[axis] / 2);
    }
  }
  const centerX = (min[0] + max[0]) / 2;
  const centerZ = (min[2] + max[2]) / 2;
  const width = Math.max(5.2, max[0] - min[0] + 0.6);
  const depth = Math.max(4.2, max[2] - min[2] + 0.6);
  const floor = Math.min(0, min[1]);
  const height = Math.max(2.7, max[1] - floor + 0.25);
  return { min: [centerX - width / 2, floor - 0.18, centerZ - depth / 2], max: [centerX + width / 2, floor + height, centerZ + depth / 2] };
}

export function getFurniturePlacementBounds(design: RoomDesign): RoomBounds & { floor: number } {
  if (design.room) return {
    min: [-design.room.width / 2, 0, -design.room.depth / 2],
    max: [design.room.width / 2, design.room.height, design.room.depth / 2], floor: 0,
  };
  if (design.inferredRoomBounds) return design.inferredRoomBounds;
  const inferred = getInferredRoomBounds(design.before?.items ?? design.items);
  if (design.source === 'demo' && design.style === 'oshi') return {
    min: [...REFERENCE_FLOOR_BOUNDS.min],
    max: [REFERENCE_FLOOR_BOUNDS.max[0], inferred.max[1], REFERENCE_FLOOR_BOUNDS.max[2]], floor: 0,
  };
  return { ...inferred, floor: inferred.min[1] + 0.1835 };
}

type PlacementItem = Pick<RoomItem, 'size' | 'rotation'> & Partial<Pick<RoomItem, 'id' | 'category'>>;

export function canPlaceOnFurniture(item: PlacementItem) {
  return Boolean(item.category && !['sofa', 'bed', 'desk', 'chair', 'shelf', 'table', 'poster', 'rug', 'mirror', 'lamp'].includes(item.category)
    && item.size.every(value => Number.isFinite(value) && value > 0 && value <= .8));
}

// Require the whole rotated footprint to fit on the rectangular top, not just
// the object's center. The highest fitting support wins; exact contact is valid.
export function furnitureSurfaceHeight(item: PlacementItem, position: RoomItem['position'], design: RoomDesign): number | null {
  if (!canPlaceOnFurniture(item)) return null;
  let height: number | null = null;
  for (const support of design.items) {
    if (support.id === item.id || !['shelf', 'desk', 'table'].includes(support.category)) continue;
    const top = support.position[1] + support.size[1] / 2;
    if (top + item.size[1] > getFurniturePlacementBounds(design).max[1] + 1e-9) continue;
    const angle = (support.rotation ?? 0) * Math.PI / 180;
    const dx = position[0] - support.position[0], dz = position[2] - support.position[2];
    const x = dx * Math.cos(angle) - dz * Math.sin(angle);
    const z = dx * Math.sin(angle) + dz * Math.cos(angle);
    const relative = ((item.rotation ?? 0) - (support.rotation ?? 0)) * Math.PI / 180;
    const halfWidth = (Math.abs(Math.cos(relative)) * item.size[0] + Math.abs(Math.sin(relative)) * item.size[2]) / 2;
    const halfDepth = (Math.abs(Math.sin(relative)) * item.size[0] + Math.abs(Math.cos(relative)) * item.size[2]) / 2;
    if (Math.abs(x) + halfWidth > support.size[0] / 2 + 1e-9 || Math.abs(z) + halfDepth > support.size[2] / 2 + 1e-9) continue;
    height = Math.max(height ?? -Infinity, top);
  }
  return height;
}

export function furniturePositionInRoom(item: PlacementItem, position: RoomItem['position'], design: RoomDesign, axes: readonly (0 | 2)[] = [0, 2]): RoomItem['position'] | null {
  if (!item.size.every(value => Number.isFinite(value) && value > 0)) return null;
  const bounds = getFurniturePlacementBounds(design);
  if (item.size[1] > bounds.max[1] - bounds.floor + 1e-9) return null;
  const angle = (item.rotation ?? 0) * Math.PI / 180;
  const halfWidth = (Math.abs(Math.cos(angle)) * item.size[0] + Math.abs(Math.sin(angle)) * item.size[2]) / 2;
  const halfDepth = (Math.abs(Math.sin(angle)) * item.size[0] + Math.abs(Math.cos(angle)) * item.size[2]) / 2;
  const next: RoomItem['position'] = [position[0], bounds.floor + item.size[1] / 2, position[2]];
  for (const [axis, halfSize] of [[0, halfWidth], [2, halfDepth]] as const) {
    if (!axes.includes(axis)) continue;
    const minimum = Math.ceil((bounds.min[axis] + halfSize - 1e-9) / LAYOUT_GRID_STEP) / 10;
    const maximum = Math.floor((bounds.max[axis] - halfSize + 1e-9) / LAYOUT_GRID_STEP) / 10;
    if (minimum > maximum) return null;
    next[axis] = Math.max(minimum, Math.min(maximum, snapToLayoutGrid(position[axis])));
  }
  next[1] = (furnitureSurfaceHeight(item, next, design) ?? bounds.floor) + item.size[1] / 2;
  return next;
}

// Manual furniture must stay on the inferred floor after placement as well.
// Other furniture keeps its existing positioning rules, including raised items.
export function snapFurnitureEditPosition(item: RoomItem, position: RoomItem['position'], axes: readonly (0 | 2)[], design: RoomDesign): RoomItem['position'] | null {
  if (canPlaceOnFurniture(item)) {
    const snapped = snapItemPosition(item, position, axes, design.room);
    return furniturePositionInRoom(item, snapped, design, axes);
  }
  if (design.room || !isManualFurniture(item)) return snapItemPosition(item, position, axes, design.room);
  const bounded = furniturePositionInRoom(item, position, design);
  return bounded ? [bounded[0], item.position[1], bounded[2]] : null;
}
