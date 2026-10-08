import { isRoomDesign, type RoomDesign, type RoomItem } from './room';

export type RoomTemplate = { id: string; design: RoomDesign; updatedAt: string };
export const isTemplateId = (id: string) => /^room-template-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function isRoomTemplate(value: unknown): value is RoomTemplate {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && isTemplateId(record.id) && isRoomDesign(record.design)
    && record.design.id === record.id && record.design.items.length <= 100
    && !!record.design.room && !!record.design.analysisInput
    && typeof record.updatedAt === 'string' && Number.isFinite(Date.parse(record.updatedAt));
}

/** Give copied furniture new identities while keeping valid shelf contacts. */
export function remapTemplateItems(items: RoomItem[], offset: RoomItem['position'] = [0, 0, 0]): RoomItem[] {
  const identities = new Map(items.map(item => [item.id, `template-object-${crypto.randomUUID()}`]));
  return items.map(original => {
    const item = structuredClone(original);
    const supportObjectId = item.supportObjectId ? identities.get(item.supportObjectId) : undefined;
    const surface = supportObjectId ? item.supportSurface : undefined;
    const supportSurface = surface ? {...surface,
      transform: [surface.transform[0], surface.transform[1], surface.transform[2] + surface.transform[0] * offset[0] + surface.transform[1] * offset[2],
        surface.transform[3], surface.transform[4], surface.transform[5] + surface.transform[3] * offset[0] + surface.transform[4] * offset[2]] as typeof surface.transform,
      height: surface.height - offset[1],
      supportPosition: surface.supportPosition.map((value, axis) => value - offset[axis]) as RoomItem['position']} : undefined;
    return {...item, id: identities.get(item.id)!, supportObjectId, supportSurface,
      position: item.position.map((value, axis) => value - offset[axis]) as RoomItem['position']};
  });
}
