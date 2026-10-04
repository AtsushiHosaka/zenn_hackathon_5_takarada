import type { RoomShape } from '../../domain/room';

const shapeRatios: Record<RoomShape, number> = { square: 1 / 1.15, standard: .75, long: .5 };
const round = (value: number) => Math.round(value * 100) / 100;

// backend/app/services/room_analyzer.rb と同じ寸法・配置の API 形式を作る。
export function createAnalyzedRoomFixture(tatami: number, shape: RoomShape) {
  const area = tatami * 1.62;
  const rawWidth = Math.sqrt(area * shapeRatios[shape]);
  const width = round(rawWidth);
  const depth = round(area / rawWidth);
  const furniture = (id: string, category: string, label: string, size: { w: number; h: number; d: number }, position: { x: number; z: number }, rotation: number, color: string) => ({
    id, source: 'existing', category, label, size, position: { ...position, y: 0 }, rotation_y: rotation, color,
    model_url: null, slot: null, attach_to: null, item_id: null, marker: null,
  });
  return {
    id: 1,
    tatami,
    shape,
    status: 'ready',
    error_message: null,
    created_at: '2026-10-04T00:00:00Z',
    scene: {
      room: {
        width, depth, height: 2.4, wall_color: '#f4f1ec', floor_color: '#c8a97e',
        windows: [{ id: 'window-1', wall: 'south', center: round(width / 2), width: 1.2, bottom: .9, height: 1.1 }],
      },
      objects: [
        furniture('bed-1', 'bed', 'ベッド', { w: .97, h: .45, d: 1.95 }, { x: .51, z: 1 }, 0, '#f2f0eb'),
        furniture('desk-1', 'desk', 'デスク', { w: 1, h: .72, d: .5 }, { x: round(width - .52), z: .27 }, 0, '#a0784f'),
        furniture('shelf-1', 'shelf', '本棚', { w: .8, h: 1.8, d: .3 }, { x: round(width - .17), z: round(depth * .6) }, 270, '#8b6a4a'),
      ],
    },
  };
}
