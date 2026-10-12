import type { RoomTemplate } from './roomTemplate';

export const quickStartPrompt = '水色の初音ミク推し活ルームにしたい';
export const starterRoomTemplates: readonly RoomTemplate[] = [{
  id: 'room-template-00000000-0000-4000-8000-000000000001', updatedAt: '2026-10-12T00:00:00Z',
  design: {
    id: 'room-template-00000000-0000-4000-8000-000000000001',
    source: 'demo', kind: 'analysis', style: 'natural', title: '6畳のベーシックルーム',
    description: '写真なしで試せる、ベッド・デスク・収納を配置した部屋です。',
    analysisInput: { tatami: 6, shape: 'standard' }, wallColor: '#f5f2ed',
    room: { width: 3, depth: 3.24, height: 2.4, floorColor: '#d8c4a8',
      windows: [{ id: 'starter-window', wall: 'north', center: 0.6, width: 1.2, bottom: 1, height: 1 }] },
    items: [
      { id: 'starter-bed', name: 'ベッド', category: 'bed', existing: true, color: '#ddd3c5', position: [-0.9, 0.3, -0.45], size: [1, 0.6, 2] },
      { id: 'starter-desk', name: 'デスク', category: 'desk', existing: true, color: '#c5a982', position: [0.65, 0.36, -1.2], size: [1.2, 0.72, 0.6] },
      { id: 'starter-chair', name: 'チェア', category: 'chair', existing: true, color: '#88847f', position: [0.65, 0.4, -0.55], size: [0.45, 0.8, 0.45] },
      { id: 'starter-shelf', name: '収納棚', category: 'shelf', existing: true, color: '#c5a982', position: [-1.2, 0.6, 1.1], size: [0.45, 1.2, 0.8] },
    ],
  },
}];
