import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RoomDesign } from '../../domain/room';

const RoomViewer = lazy(() => import('./RoomViewer'));
const ignoreSelection = () => {};
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <PreviewPlaceholder failed/> : this.props.children; }
}
function PreviewPlaceholder({ failed = false }: { failed?: boolean }) {
  return <span className={`room-list-preview-placeholder${failed ? ' is-unavailable' : ''}`} role="status" aria-label={failed ? '3Dモデルを表示できませんでした' : '3Dモデルを読み込み中'}>{failed ? '◇' : ''}</span>;
}
function SavedRoomViewer({ design }: { design: RoomDesign }) {
  const [ready, setReady] = useState<boolean | null>(null);
  if (ready === false) return <PreviewPlaceholder failed/>;
  return <>
    {ready === null && <PreviewPlaceholder/>}
    <div className={`room-list-live-model${ready ? ' is-ready motion-fade' : ''}`}><Suspense fallback={null}>
      <RoomViewer design={design} selectedItemId={null} onSelectItem={ignoreSelection} view="perspective" resetKey={0} preview onReady={setReady}/>
    </Suspense></div>
  </>;
}
// 画面内の部屋だけを描画し、一覧を離れたらモデルとWebGLを破棄する。
export default function RoomPreview({ design }: { design: RoomDesign }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={host} className="room-list-preview" aria-label={`${design.title}の3Dプレビュー`}>
    {visible && <PreviewBoundary key={JSON.stringify(design)}><SavedRoomViewer design={design}/></PreviewBoundary>}
  </div>;
}
