import { isRoomItem, type FurnitureCategory, type RoomGeometry, type RoomItem } from '../../domain/room';

export const FURNITURE_DRAG_TYPE = 'application/x-room-furniture';

export const furnitureTemplates: { category: FurnitureCategory; name: string; size: RoomItem['size']; color: string }[] = [
  { category: 'sofa', name: 'ソファ', size: [1.8, 0.8, 0.85], color: '#BBA5EE' },
  { category: 'bed', name: 'ベッド', size: [1, 0.5, 2], color: '#F4EFE6' },
  { category: 'desk', name: 'デスク', size: [1.2, 0.72, 0.6], color: '#C5A582' },
  { category: 'chair', name: 'チェア', size: [0.45, 0.8, 0.45], color: '#73966C' },
  { category: 'shelf', name: '収納棚', size: [0.8, 1.2, 0.35], color: '#C5A582' },
  { category: 'table', name: 'テーブル', size: [1, 0.4, 0.6], color: '#C5A582' },
];

export function createFurnitureItem(category: FurnitureCategory, size?: RoomItem['size']): RoomItem {
  const template = furnitureTemplates.find(candidate => candidate.category === category)!;
  const dimensions: RoomItem['size'] = [...(size ?? template.size)];
  return {
    id: `manual-${crypto.randomUUID()}`,
    name: template.name,
    category,
    existing: true,
    color: template.color,
    size: dimensions,
    position: [0, dimensions[1] / 2, 0],
    rotation: 0,
  };
}

export function isFurnitureWithinRoom(item: Pick<RoomItem, 'size' | 'rotation'>, room?: RoomGeometry): boolean {
  if (!item.size.every(value => Number.isFinite(value) && value > 0)) return false;
  if (!room) return true;
  const angle = (item.rotation ?? 0) * Math.PI / 180;
  const width = Math.abs(Math.cos(angle)) * item.size[0] + Math.abs(Math.sin(angle)) * item.size[2];
  const depth = Math.abs(Math.sin(angle)) * item.size[0] + Math.abs(Math.cos(angle)) * item.size[2];
  return width <= room.width + 1e-9 && depth <= room.depth + 1e-9 && item.size[1] <= room.height + 1e-9;
}

export function getFurnitureDropItem(dataTransfer: Pick<DataTransfer, 'getData'>): RoomItem | null {
  try {
    const item: unknown = JSON.parse(dataTransfer.getData(FURNITURE_DRAG_TYPE));
    return isRoomItem(item) && item.id.startsWith('manual-') && item.existing ? item : null;
  } catch {
    return null;
  }
}
