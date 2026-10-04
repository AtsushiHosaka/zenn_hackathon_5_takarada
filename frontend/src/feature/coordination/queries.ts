// 部屋・コーデのデータ取得。解析・生成は非同期なので、終わるまで 1 秒ごとにポーリングする。
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRepositories } from "../../core/repositories";
import type { CoordinationId, CoordinationInput } from "../../domain/coordination";
import type { RoomId, RoomInput } from "../../domain/room";

const POLL_MS = 1000;

export const roomKeys = {
  detail: (id: RoomId) => ["rooms", id] as const,
};

export const coordinationKeys = {
  detail: (id: CoordinationId) => ["coordinations", id] as const,
};

export function useRoom(id: RoomId) {
  const { rooms } = useRepositories();
  return useQuery({
    queryKey: roomKeys.detail(id),
    queryFn: () => rooms.find(id),
    refetchInterval: (query) => (query.state.data?.status === "analyzing" ? POLL_MS : false),
  });
}

export function useCreateRoom() {
  const { rooms } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomInput) => rooms.create(input),
    onSuccess: (room) => queryClient.setQueryData(roomKeys.detail(room.id), room),
  });
}

export function useCoordination(id: CoordinationId) {
  const { coordinations } = useRepositories();
  return useQuery({
    queryKey: coordinationKeys.detail(id),
    queryFn: () => coordinations.find(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? POLL_MS : false;
    },
  });
}

export function useCreateCoordination(roomId: RoomId) {
  const { coordinations } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CoordinationInput) => coordinations.create(roomId, input),
    onSuccess: (coordination) => queryClient.setQueryData(coordinationKeys.detail(coordination.id), coordination),
  });
}
