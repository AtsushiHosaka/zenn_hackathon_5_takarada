import { useQuery, type QueryClient } from '@tanstack/react-query';
import { isRoomDesign, type RoomDesign } from '../../domain/room';

export const roomPlanKeys = { capabilities: ['room', 'capabilities'] as const, list: ['room', 'plans'] as const, detail: (id: string) => ['room', 'design', id] as const };
const storageKey = 'room-coordinator.plans';
function readPlans(): RoomDesign[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(value) ? value.filter(isRoomDesign).slice(0, 30) : [];
  } catch { return []; }
}
export function useRoomPlans(): RoomDesign[] {
  return useQuery({ queryKey: roomPlanKeys.list, queryFn: readPlans, initialData: readPlans, staleTime: Infinity }).data;
}
export function saveRoomPlan(client: QueryClient, design: RoomDesign): void {
  const previous = client.getQueryData<RoomDesign[]>(roomPlanKeys.list) ?? readPlans();
  const next = [design, ...previous.filter((item) => item.id !== design.id)].slice(0, 30);
  // Write before changing the cache so quota errors never pretend to have saved the plan.
  localStorage.setItem(storageKey, JSON.stringify(next));
  client.setQueryData(roomPlanKeys.list, next);
  client.setQueryData(roomPlanKeys.detail(design.id), design);
}
