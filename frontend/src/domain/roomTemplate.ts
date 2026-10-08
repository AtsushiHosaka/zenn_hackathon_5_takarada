import { isRoomDesign, type RoomDesign } from './room';

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
