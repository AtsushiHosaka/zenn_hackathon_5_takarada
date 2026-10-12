import type { RoomDesign, RoomShape } from '../../domain/room';
import type { RoomTemplate } from '../../domain/roomTemplate';

// 最初から使える部屋。サーバーが写真なしで作る 6 畳の部屋 (RoomAnalyzer のモック: ベッド・デスク・本棚・南の窓) と同じ寸法と配置。
// 寸法は部屋の左奥の角からの距離 (m)。
const rooms: { id: string; shape: RoomShape; title: string; width: number; depth: number; desk: number; shelf: [number, number] }[] = [
  { id: 'room-template-00000000-0000-4000-8000-000000000001', shape: 'square', title: '6畳・正方形に近い部屋', width: 2.91, depth: 3.34, desk: 2.37, shelf: [2.74, 1.67] },
  { id: 'room-template-00000000-0000-4000-8000-000000000002', shape: 'standard', title: '6畳・やや縦長の部屋', width: 2.7, depth: 3.6, desk: 2.17, shelf: [2.53, 1.82] },
  { id: 'room-template-00000000-0000-4000-8000-000000000003', shape: 'long', title: '6畳・細長い部屋', width: 2.2, depth: 4.41, desk: 1.67, shelf: [2.03, 2.22] },
];

function design({ id, shape, title, width, depth, desk, shelf }: typeof rooms[number]): RoomDesign {
  const item = (itemId: string, name: string, category: string, color: string, size: [number, number, number], x: number, z: number, rotation = 0) =>
    ({ id: itemId, name, category, existing: true, color, size, rotation, position: [x - width / 2, size[1] / 2, z - depth / 2] as [number, number, number] });
  return {
    id, source: 'demo', kind: 'analysis', title, description: '最初から使える部屋のテンプレートです。', style: 'natural',
    wallColor: '#f4f1ec', floorColor: '#c8a97e', analysisInput: { tatami: 6, shape },
    room: { width, depth, height: 2.4, floorColor: '#c8a97e', windows: [{ id: 'window-1', wall: 'south', center: width / 2, width: 1.2, bottom: 0.9, height: 1.1 }] },
    items: [
      item('bed-1', 'ベッド', 'bed', '#f2f0eb', [0.97, 0.45, 1.95], 0.505, 0.995),
      item('desk-1', 'デスク', 'desk', '#a0784f', [1, 0.72, 0.5], desk, 0.27),
      item('shelf-1', '本棚', 'shelf', '#8b6a4a', [0.8, 1.8, 0.3], shelf[0], shelf[1], 270),
    ],
  };
}

export const defaultRoomTemplates: RoomTemplate[] = rooms.map(room => ({ id: room.id, design: design(room), updatedAt: '2026-10-12T00:00:00.000Z' }));
// 最初から使えるテンプレートは、編集も削除もできない。
export const isDefaultRoomTemplate = (id: string) => rooms.some(room => room.id === id);
