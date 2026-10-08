import { useQuery, type QueryClient } from '@tanstack/react-query';
import { isRoomDesign, type RoomDesign } from '../../domain/room';
import type { SavedRoom } from '../../domain/roomRepository';
import { useSession } from '../../core/session';
import { useRepositories } from '../../core/repositories';
import { loadConnection } from '../../core/connection';
import { appConfig } from '../../core/config';

export const roomPlanKeys = { capabilities: ['room', 'capabilities'] as const };
export const scopedRoomPlanKeys = (scope: string) => ({
  list: ['room', scope, 'plans'] as const,
  saved: ['room', scope, 'saved'] as const,
  detail: (id: string) => ['room', scope, 'design', id] as const,
});
export function useRoomPlanScope(): string {
  const session = useSession();
  return JSON.stringify([loadConnection(), appConfig.apiEndpoint, session.user?.id ?? 'guest']);
}
const storageKey = (scope: string) => `room-coordinator.plans.v2:${scope}`;
function readPlans(scope: string): RoomDesign[] {
  try {
    // Legacy unowned plans remain on disk; never assign them to the next login.
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(scope)) || '[]');
    return Array.isArray(value) ? value.filter(isRoomDesign) : [];
  } catch { return []; }
}
function useLocalPlans(): RoomDesign[] {
  const scope = useRoomPlanScope();
  return useQuery({ queryKey: scopedRoomPlanKeys(scope).list, queryFn: () => readPlans(scope), initialData: () => readPlans(scope), staleTime: Infinity }).data;
}
export function useSavedRooms() {
  const scope = useRoomPlanScope();
  const session = useSession();
  const { rooms } = useRepositories();
  const local = useLocalPlans();
  const query = useQuery({
    queryKey: scopedRoomPlanKeys(scope).saved,
    queryFn: ({ signal }) => rooms.list(signal),
    enabled: session.status === 'authenticated',
    refetchOnMount: 'always',
    refetchInterval: query => query.state.data?.some(room => room.status === 'analyzing') ? 3000 : false,
  });
  const saved: SavedRoom[] = (query.data ?? []).map(room => {
    const overlay = local.find(plan => plan.id === room.design?.id || (
      plan.backendRoomId === room.id && plan.kind === 'coordination'
      && Number(plan.id.replace('api-coordination-', '')) > Number(room.design?.kind === 'coordination' ? room.design.id.replace('api-coordination-', '') : 0)
    ));
    return overlay ? { ...room, title: overlay.title, design: overlay } : room;
  });
  for (const design of local) {
    if (saved.some(room => room.id === (design.backendRoomId ?? design.id))) continue;
    saved.push({ id: design.backendRoomId ?? design.id, title: design.title, status: 'ready', createdAt: '', design });
  }
  return { ...query, data: session.status === 'authenticated' ? saved : [] };
}
export function useRoomPlans(): RoomDesign[] {
  return useSavedRooms().data.flatMap(room => room.design ? [room.design] : []);
}
export function useRoomPlan(id: string, enabled: boolean) {
  const scope = useRoomPlanScope();
  const { rooms } = useRepositories();
  return useQuery({
    queryKey: scopedRoomPlanKeys(scope).detail(id),
    queryFn: ({ signal }) => rooms.get(id, signal),
    initialData: () => readPlans(scope).find(plan => plan.id === id),
    enabled,
    staleTime: Infinity,
  });
}
export function saveRoomPlan(client: QueryClient, design: RoomDesign, scope: string): void {
  const keys = scopedRoomPlanKeys(scope);
  const previous = client.getQueryData<RoomDesign[]>(keys.list) ?? readPlans(scope);
  const next = [design, ...previous.filter(item => item.id !== design.id)];
  // Keep the current session usable even if browser storage is full.
  client.setQueryData(keys.list, next);
  client.setQueryData(keys.detail(design.id), design);
  void client.invalidateQueries({ queryKey: keys.saved });
  localStorage.setItem(storageKey(scope), JSON.stringify(next));
}
