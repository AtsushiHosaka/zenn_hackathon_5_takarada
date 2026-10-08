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
  const inferred = getInferredRoomBounds(design.before?.items ?? design.items);
  if (design.source === 'demo' && design.style === 'oshi') return {
    min: [...REFERENCE_FLOOR_BOUNDS.min],
    max: [REFERENCE_FLOOR_BOUNDS.max[0], inferred.max[1], REFERENCE_FLOOR_BOUNDS.max[2]], floor: 0,
  };
  return { ...inferred, floor: inferred.min[1] + 0.1835 };
}

export function furniturePositionInRoom(item: Pick<RoomItem, 'size' | 'rotation'>, position: RoomItem['position'], design: RoomDesign): RoomItem['position'] | null {
  if (!item.size.every(value => Number.isFinite(value) && value > 0)) return null;
  const bounds = getFurniturePlacementBounds(design);
  if (item.size[1] > bounds.max[1] - bounds.floor + 1e-9) return null;
  const angle = (item.rotation ?? 0) * Math.PI / 180;
  const halfWidth = (Math.abs(Math.cos(angle)) * item.size[0] + Math.abs(Math.sin(angle)) * item.size[2]) / 2;
  const halfDepth = (Math.abs(Math.sin(angle)) * item.size[0] + Math.abs(Math.cos(angle)) * item.size[2]) / 2;
  const next: RoomItem['position'] = [position[0], bounds.floor + item.size[1] / 2, position[2]];
  for (const [axis, halfSize] of [[0, halfWidth], [2, halfDepth]] as const) {
    const minimum = Math.ceil((bounds.min[axis] + halfSize - 1e-9) / LAYOUT_GRID_STEP) / 10;
    const maximum = Math.floor((bounds.max[axis] - halfSize + 1e-9) / LAYOUT_GRID_STEP) / 10;
    if (minimum > maximum) return null;
    next[axis] = Math.max(minimum, Math.min(maximum, snapToLayoutGrid(position[axis])));
  }
  return next;
}

// Manual furniture must stay on the inferred floor after placement as well.
// Other furniture keeps its existing positioning rules, including raised items.
export function snapFurnitureEditPosition(item: RoomItem, position: RoomItem['position'], axes: readonly (0 | 2)[], design: RoomDesign): RoomItem['position'] | null {
  if (design.room || !isManualFurniture(item)) return snapItemPosition(item, position, axes, design.room);
  const bounded = furniturePositionInRoom(item, position, design);
  return bounded ? [bounded[0], item.position[1], bounded[2]] : null;
}
