import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useRepositories } from '../../core/repositories';
import { DomainError } from '../../domain/error';
import { isRoomDesign, type RoomDesign, type RoomItem } from '../../domain/room';
import { copyFurniture } from '../../domain/furnitureCopy';
import { isRoomTemplate, type RoomTemplate } from '../../domain/roomTemplate';
import { saveRoomPlan, scopedRoomPlanKeys, useRoomPlanScope } from './plans';
import { getFurniturePlacementBounds } from './roomBounds';
import { readRoomTemplates, templateKeys, templateStorageKey } from './templateStorage';

export function useRoomTemplates() {
  const scope = useRoomPlanScope();
  const keys = templateKeys(scope);
  const query = useQuery({ queryKey: keys.list, queryFn: () => readRoomTemplates(scope), staleTime: Infinity });
  const warning = useQuery({ queryKey: keys.warning, queryFn: () => '', initialData: '', staleTime: Infinity }).data;
  return { ...query, data: query.data ?? [], warning };
}
// テンプレートから部屋を作り、その部屋の画面へ進む。
export function useCreateRoomFromTemplate() {
  const scope = useRoomPlanScope();
  const { rooms, tokenStore } = useRepositories();
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (design: RoomDesign) => {
      const token = tokenStore.load();
      const room = await rooms.createFromTemplate(design);
      if (tokenStore.load() !== token) throw new Error('ログイン状態が変わりました。もう一度お試しください。');
      return room;
    },
    onSuccess: room => {
      let notice: string | undefined;
      try { saveRoomPlan(client, room, scope); } catch { notice = 'このタブでは部屋を使えますが、編集内容をブラウザに保存できませんでした。'; }
      navigate(`/rooms/${room.id}`, { state: { editing: true, notice } });
    },
  });
}
function writeTemplates(client: QueryClient, scope: string, next: RoomTemplate[]) {
  const keys = templateKeys(scope);
  client.setQueryData(keys.list, next);
  try { localStorage.setItem(templateStorageKey(scope), JSON.stringify(next)); client.setQueryData(keys.warning, ''); }
  catch { client.setQueryData(keys.warning, 'テンプレートの変更はこのタブに保持しています。ブラウザに保存できないため、再読み込みすると失われます。'); }
}
export function saveRoomTemplate(client: QueryClient, scope: string, design: RoomDesign) {
  const entry = { id: design.id, design: structuredClone(design), updatedAt: new Date().toISOString() };
  if (!isRoomTemplate(entry)) throw new DomainError('テンプレートの内容を確認してください。');
  const previous = client.getQueryData<RoomTemplate[]>(templateKeys(scope).list) ?? readRoomTemplates(scope);
  writeTemplates(client, scope, [entry, ...previous.filter(item => item.id !== entry.id)]);
  client.setQueryData(scopedRoomPlanKeys(scope).detail(design.id), entry.design);
}
export function deleteRoomTemplate(client: QueryClient, scope: string, id: string) {
  const previous = client.getQueryData<RoomTemplate[]>(templateKeys(scope).list) ?? readRoomTemplates(scope);
  writeTemplates(client, scope, previous.filter(item => item.id !== id));
  client.removeQueries({ queryKey: scopedRoomPlanKeys(scope).detail(id) });
}
export function createTemplateSnapshot(design: RoomDesign, title: string): RoomDesign {
  if (design.modelUrl && design.modelKind !== 'shell') throw new DomainError('家具を含む完成モデルはテンプレートに保存できません。個別に編集できる部屋を選んでください。');
  const bounds = getFurniturePlacementBounds(design);
  const center: RoomItem['position'] = [(bounds.min[0] + bounds.max[0]) / 2, bounds.floor, (bounds.min[2] + bounds.max[2]) / 2];
  const room = structuredClone(design.room ?? {width: bounds.max[0] - bounds.min[0], depth: bounds.max[2] - bounds.min[2], height: bounds.max[1] - bounds.floor, floorColor: '#e8dcc6', windows: []});
  room.floorColor = design.floorColor ?? room.floorColor;
  const analysisInput = design.analysisInput ?? { tatami: Math.max(3, Math.min(30, room.width * room.depth / 1.62)), shape: 'standard' as const };
  const snapshot: RoomDesign = {
    id: `room-template-${crypto.randomUUID()}`, source: design.source, kind: 'analysis', title: title.trim(),
    description: '保存した部屋のテンプレートです。', style: design.style, room, analysisInput,
    wallColor: design.wallColor, floorColor: design.floorColor, prompt: design.prompt, roomPaletteId: design.roomPaletteId, characterThemeId: design.characterThemeId,
    items: copyFurniture(design.items, 'template-object', design.room ? [0, 0, 0] : center).map(item => {
      return {...item, existing: true,
        name: item.name.slice(0,100),
        marker: undefined, productId: undefined, furnitureDetailId: undefined,
        replacesObjectId: undefined, materialOverrides: undefined};
    }),
  };
  if (!isRoomDesign(snapshot) || snapshot.items.length > 100 || !snapshot.title || snapshot.title.length > 80) throw new DomainError('テンプレート名は80文字以内、家具は100点以内にしてください。');
  return snapshot;
}
