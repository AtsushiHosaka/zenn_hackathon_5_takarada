// 部屋・コーデのダミー。メモリ上に持ち、リロードすると消える。
// 実 API と同じく非同期で進むように、作ってから少し経つと解析・生成が終わった扱いにする
// (画面のポーリングと「解析中…」表示がダミーでも確かめられる)。
// 中身は入力にかかわらず sampleRoomScene / sampleCoordination を返す。
import { DomainError } from "../../domain/error";
import type { Coordination, CoordinationId } from "../../domain/coordination";
import type { CoordinationRepository } from "../../domain/coordinationRepository";
import type { Room, RoomId } from "../../domain/room";
import type { RoomRepository } from "../../domain/roomRepository";
import { toCoordination } from "../records/coordination";
import { toScene } from "../records/scene";
import { tick } from "./dummyDatabase";
import { sampleCoordination, sampleRoomScene } from "./dummyCoordinationData";

const PROCESSING_MS = 1500;

const rooms = new Map<RoomId, Room>();
const coordinations = new Map<CoordinationId, Coordination>();
let nextRoomId: RoomId = 1;
let nextCoordinationId: CoordinationId = 1;

const isDone = (createdAt: Date) => Date.now() - createdAt.getTime() >= PROCESSING_MS;

export function createDummyRoomRepository(): RoomRepository {
  return {
    async create(input) {
      await tick();
      const room: Room = {
        id: nextRoomId++,
        tatami: input.tatami,
        shape: input.shape,
        status: "analyzing",
        scene: null,
        errorMessage: null,
        createdAt: new Date(),
      };
      rooms.set(room.id, room);
      return { ...room };
    },

    async find(id) {
      await tick();
      const room = rooms.get(id);
      if (!room) throw new DomainError("部屋が見つかりません", 404);
      if (room.status === "analyzing" && isDone(room.createdAt)) {
        room.status = "ready";
        room.scene = toScene(sampleRoomScene);
      }
      return { ...room };
    },
  };
}

export function createDummyCoordinationRepository(): CoordinationRepository {
  return {
    async create(roomId, input) {
      await tick();
      const room = rooms.get(roomId);
      if (!room) throw new DomainError("部屋が見つかりません", 404);
      if (room.status !== "ready") throw new DomainError("部屋の解析が終わっていません", 422);

      const coordination: Coordination = {
        id: nextCoordinationId++,
        roomId,
        status: "pending",
        prompt: input.prompt,
        budget: input.budget,
        keptObjectIds: input.keptObjectIds,
        title: null,
        comment: null,
        beforeScene: room.scene,
        afterScene: null,
        items: [],
        totalPrice: null,
        errorMessage: null,
        createdAt: new Date(),
      };
      coordinations.set(coordination.id, coordination);
      return { ...coordination };
    },

    async find(id) {
      await tick();
      const coordination = coordinations.get(id);
      if (!coordination) throw new DomainError("コーデが見つかりません", 404);
      if (coordination.status === "pending" && isDone(coordination.createdAt)) {
        const done = toCoordination({
          id: coordination.id,
          room_id: coordination.roomId,
          status: "done",
          prompt: coordination.prompt,
          budget: coordination.budget,
          kept_object_ids: coordination.keptObjectIds,
          before_scene: sampleRoomScene,
          error_message: null,
          created_at: coordination.createdAt.toISOString(),
          ...sampleCoordination,
        });
        coordinations.set(id, done);
        return { ...done };
      }
      return { ...coordination };
    },
  };
}
