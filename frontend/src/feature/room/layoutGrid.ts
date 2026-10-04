import type { RoomGeometry, RoomItem } from '../../domain/room';

export const LAYOUT_GRID_STEP = 0.1;

// Round both signs symmetrically, including coordinates halfway between cells.
export function snapToLayoutGrid(value: number) {
  return Math.sign(value) * Math.round(Math.abs(value) / LAYOUT_GRID_STEP + 1e-9) / 10;
}

export function snapItemPosition(item: RoomItem, position: RoomItem['position'], axes: readonly (0 | 2)[], room?: RoomGeometry): RoomItem['position'] {
  const next: RoomItem['position'] = [...item.position];
  const angle = (item.rotation ?? 0) * Math.PI / 180;
  const halfWidth = (Math.abs(Math.cos(angle)) * item.size[0] + Math.abs(Math.sin(angle)) * item.size[2]) / 2;
  const halfDepth = (Math.abs(Math.sin(angle)) * item.size[0] + Math.abs(Math.cos(angle)) * item.size[2]) / 2;
  for (const axis of axes) {
    let value = snapToLayoutGrid(position[axis]);
    if (room) {
      const limit = (axis === 0 ? room.width / 2 - halfWidth : room.depth / 2 - halfDepth);
      const cells = Math.floor((limit + 1e-9) / LAYOUT_GRID_STEP);
      if (cells < 0) continue;
      value = Math.max(-cells / 10, Math.min(cells / 10, value));
    }
    next[axis] = value === 0 ? 0 : value;
  }
  return next;
}
