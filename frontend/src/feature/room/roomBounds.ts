import { isFurnitureSupportSurface, isManualFurniture, type RoomDesign, type RoomItem } from '../../domain/room';
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

type PlacementItem = Pick<RoomItem, 'size' | 'rotation'> & Partial<Pick<RoomItem, 'id' | 'category' | 'supportObjectId' | 'supportSurface'>>;

export function canPlaceOnFurniture(item: PlacementItem) {
  if (['blanket', 'cushion', 'bed_cover', 'cover'].includes(item.category ?? '')) return item.size.every(value => Number.isFinite(value) && value > 0) && item.size[1] <= .4;
  return Boolean(item.category && !['sofa', 'bed', 'desk', 'chair', 'shelf', 'table', 'storage', 'tv_stand', 'display', 'display_case', 'wall_shelf', 'poster', 'rug', 'mirror', 'wall_mirror'].includes(item.category)
    && item.size.every(value => Number.isFinite(value) && value > 0 && value <= .8));
}

export function isFurnitureSupport(item: RoomItem) {
  return ['shelf', 'desk', 'table', 'storage', 'tv_stand', 'display', 'display_case', 'wall_shelf', 'bed', 'sofa', 'bed_cover', 'cover'].includes(item.category);
}

// Captured rendered footprints include circular tops. API-restored objects
// instead retain the confirmed height within the supporting object's bounds.
export function fitsFurnitureSurface(item: PlacementItem, position: RoomItem['position'], surface: NonNullable<RoomItem['supportSurface']>): boolean {
  if (!isFurnitureSupportSurface(surface) || !item.size.every(value => Number.isFinite(value) && value > 0) || !position.every(Number.isFinite) || !Number.isFinite(item.rotation ?? 0)) return false;
  const [a, b, c, d, e, f] = surface.transform;
  const [minX, minZ, maxX, maxZ] = surface.bounds;
  const angle = (item.rotation ?? 0) * Math.PI / 180;
  for (const x of [-item.size[0] / 2, item.size[0] / 2]) for (const z of [-item.size[2] / 2, item.size[2] / 2]) {
    const worldX = position[0] + Math.cos(angle) * x + Math.sin(angle) * z;
    const worldZ = position[2] - Math.sin(angle) * x + Math.cos(angle) * z;
    const localX = a * worldX + b * worldZ + c, localZ = d * worldX + e * worldZ + f;
    if (localX < minX - .0001 || localX > maxX + .0001 || localZ < minZ - .0001 || localZ > maxZ + .0001) return false;
    if (surface.radius !== undefined && Math.hypot(localX, localZ) > surface.radius + .0001) return false;
  }
  return true;
}

export function furnitureSurfaceHeight(item: PlacementItem, position: RoomItem['position'], design: RoomDesign): number | null {
  if (!canPlaceOnFurniture(item)) return null;
  const support = design.items.find(candidate => candidate.id === item.supportObjectId && candidate.id !== item.id && isFurnitureSupport(candidate));
  // The API persists the supporting object and the confirmed height, while a
  // surface picked in this browser also carries its exact rendered footprint.
  let surface = item.supportSurface;
  if (!surface && support) {
    const angle = (support.rotation ?? 0) * Math.PI / 180;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    surface = {
      transform: [cosine, -sine, -cosine * support.position[0] + sine * support.position[2], sine, cosine, -sine * support.position[0] - cosine * support.position[2]],
      bounds: [-support.size[0] / 2, -support.size[2] / 2, support.size[0] / 2, support.size[2] / 2],
      height: position[1] - item.size[1] / 2,
      supportPosition: [...support.position], supportSize: [...support.size], supportRotation: support.rotation ?? 0,
    };
  }
  if (!surface || !isFurnitureSupportSurface(surface)) return null;
  if (!support || JSON.stringify([support.position, support.size, support.rotation ?? 0]) !== JSON.stringify([surface.supportPosition, surface.supportSize, surface.supportRotation])) return null;
  const bounds = getFurniturePlacementBounds(design);
  const clearance = !item.supportSurface && ['bed', 'sofa'].includes(support.category) ? .05 : .001;
  if (surface.height < support.position[1] - support.size[1] / 2 || surface.height > support.position[1] + support.size[1] / 2 + clearance || surface.height <= bounds.floor + .0001 || surface.height + item.size[1] > bounds.max[1] + 1e-9 || Math.abs(position[1] - item.size[1] / 2 - surface.height) > .001) return null;
  // A duvet intentionally covers more than the bed's footprint. Captured
  // browser surfaces still require an exact fit when placing a new object.
  if (!item.supportSurface && ['bed_cover', 'cover'].includes(item.category ?? '') && support.category === 'bed') return surface.height;
  return fitsFurnitureSurface(item, position, surface) ? surface.height : null;
}

export function followFurnitureSupport(item: RoomItem, previousSupport: RoomItem, support: RoomItem): RoomItem {
  const delta = ((support.rotation ?? 0) - (previousSupport.rotation ?? 0)) * Math.PI / 180;
  const cosine = Math.cos(delta), sine = Math.sin(delta);
  const x = item.position[0] - previousSupport.position[0], z = item.position[2] - previousSupport.position[2];
  const heightDelta = support.position[1] - previousSupport.position[1];
  let surface = item.supportSurface;
  if (surface) {
    const [a, b, c, d, e, f] = surface.transform;
    const na = a * cosine + b * sine, nb = -a * sine + b * cosine;
    const nd = d * cosine + e * sine, ne = -d * sine + e * cosine;
    surface = { ...surface,
      transform: [na, nb, c + a * previousSupport.position[0] + b * previousSupport.position[2] - na * support.position[0] - nb * support.position[2], nd, ne, f + d * previousSupport.position[0] + e * previousSupport.position[2] - nd * support.position[0] - ne * support.position[2]],
      height: surface.height + heightDelta,
      supportPosition: [...support.position], supportSize: [...support.size], supportRotation: support.rotation ?? 0,
    };
  }
  return { ...item, position: [support.position[0] + cosine * x + sine * z, item.position[1] + heightDelta, support.position[2] - sine * x + cosine * z],
    rotation: ((item.rotation ?? 0) + (support.rotation ?? 0) - (previousSupport.rotation ?? 0) + 360) % 360,
    supportSurface: surface,
  };
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
  next[1] = (furnitureSurfaceHeight(item, [next[0], position[1], next[2]], design) ?? bounds.floor) + item.size[1] / 2;
  return next;
}

// Manual furniture must stay on the inferred floor after placement as well.
// Other furniture keeps its existing positioning rules, including raised items.
export function snapFurnitureEditPosition(item: RoomItem, position: RoomItem['position'], axes: readonly (0 | 2)[], design: RoomDesign): RoomItem['position'] | null {
  if (canPlaceOnFurniture(item)) {
    const snapped = snapItemPosition(item, position, axes, design.room);
    snapped[1] = position[1];
    return furniturePositionInRoom(item, snapped, design, axes);
  }
  if (design.room || !isManualFurniture(item)) return snapItemPosition(item, position, axes, design.room);
  const bounded = furniturePositionInRoom(item, position, design);
  return bounded ? [bounded[0], item.position[1], bounded[2]] : null;
}
