import type { RoomItem } from './room';

/** Copy a complete furniture set before resolving relationships between items. */
export function copyFurniture(items: RoomItem[], prefix = 'template-object', origin: RoomItem['position'] = [0, 0, 0]): RoomItem[] {
  const ids = new Map(items.map(item => [item.id, `${prefix}-${crypto.randomUUID()}`]));
  const translate = (position: RoomItem['position']): RoomItem['position'] => [position[0] - origin[0], position[1] - origin[1], position[2] - origin[2]];
  return items.map(original => {
    const item = structuredClone(original);
    const supportObjectId = item.supportObjectId !== item.id ? ids.get(item.supportObjectId ?? '') : undefined;
    const supportSurface = supportObjectId ? item.supportSurface : undefined;
    if (supportSurface) {
      // New world coordinates equal old world coordinates minus the origin.
      // The captured world-to-local surface transform therefore adds it back.
      const [a, b, c, d, e, f] = supportSurface.transform;
      supportSurface.transform = [a, b, c + a * origin[0] + b * origin[2], d, e, f + d * origin[0] + e * origin[2]];
      supportSurface.height -= origin[1];
      supportSurface.supportPosition = translate(supportSurface.supportPosition);
    }
    return {...item, id: ids.get(item.id)!, position: translate(item.position), supportObjectId, supportSurface};
  });
}
