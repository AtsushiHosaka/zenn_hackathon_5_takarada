import { DomainError } from '../../domain/error';
import { isRoomTemplate, type RoomTemplate } from '../../domain/roomTemplate';
import { normalizeRoomBedding } from '../../domain/bedding';
export const templateKeys = (scope: string) => ({ list: ['room', scope, 'templates'] as const, warning: ['room', scope, 'templates', 'warning'] as const });
export const templateStorageKey = (scope: string) => `room-coordinator.templates.v1:${scope}`;
export function readRoomTemplates(scope: string): RoomTemplate[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(templateStorageKey(scope)) ?? '[]');
    if (!Array.isArray(value) || !value.every(isRoomTemplate) || new Set(value.map(item => item.id)).size !== value.length) throw new Error('Invalid templates');
    return value.map(template => ({ ...template, design: normalizeRoomBedding(template.design) }));
  } catch { throw new DomainError('テンプレートを読み込めません。ブラウザの保存設定を確認してください。'); }
}
