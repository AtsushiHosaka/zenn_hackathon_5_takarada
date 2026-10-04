import { useQuery, type QueryClient } from '@tanstack/react-query';
import { isRoomDesign, type RoomDesign } from '../../domain/room';
import { useSession } from '../../core/session';
import { loadConnection } from '../../core/connection';
import { appConfig } from '../../core/config';

export const roomPlanKeys = { capabilities: ['room', 'capabilities'] as const };
export const scopedRoomPlanKeys = (scope: string) => ({ list: ['room', scope, 'plans'] as const, detail: (id: string) => ['room', scope, 'design', id] as const });
export function useRoomPlanScope(): string {
  const session = useSession();
  return JSON.stringify([loadConnection(), appConfig.apiEndpoint, session.user?.id ?? 'guest']);
}
const storageKey = (scope: string) => `room-coordinator.plans.v2:${scope}`;
function readPlans(scope: string): RoomDesign[] {
  try {
    // Legacy unowned plans remain on disk; never assign them to the next login.
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(scope)) || '[]');
    return Array.isArray(value) ? value.filter(isRoomDesign).slice(0, 30) : [];
  } catch { return []; }
}
export function useRoomPlans(): RoomDesign[] {
  const scope = useRoomPlanScope();
  return useQuery({ queryKey: scopedRoomPlanKeys(scope).list, queryFn: () => readPlans(scope), initialData: () => readPlans(scope), staleTime: Infinity }).data;
}
export function saveRoomPlan(client: QueryClient, design: RoomDesign, scope: string): void {
  const keys = scopedRoomPlanKeys(scope);
  const previous = client.getQueryData<RoomDesign[]>(keys.list) ?? readPlans(scope);
  const next = [design, ...previous.filter((item) => item.id !== design.id)].slice(0, 30);
  localStorage.setItem(storageKey(scope), JSON.stringify(next));
  client.setQueryData(keys.list, next);
  client.setQueryData(keys.detail(design.id), design);
}
