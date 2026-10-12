import { lazy, Suspense } from 'react';
import type { RoomDesign } from '../../domain/room';

const RoomViewer = lazy(() => import('./RoomViewer'));
const ignoreSelection = () => {};

// 写真を撮るためだけに、画面の外で部屋の3Dモデルを描く。
export default function RoomSnapshotStudio({ design, onSnapshot, onReady }: { design: RoomDesign; onSnapshot: (dataUrl: string) => void; onReady: () => void }) {
  return <div className="room-snapshot-studio" aria-hidden="true" inert>
    <Suspense fallback={null}>
      <RoomViewer design={design} selectedItemId={null} onSelectItem={ignoreSelection} view="perspective" resetKey={0} preview onSnapshot={onSnapshot} onReady={onReady}/>
    </Suspense>
  </div>;
}
