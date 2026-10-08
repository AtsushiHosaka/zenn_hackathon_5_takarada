import { useState } from 'react';
import { Link } from 'react-router';
import type { RoomDesign, RoomShape } from '../../domain/room';
import type { SavedRoom } from '../../domain/roomRepository';
import { motionStaggerStyle } from '../../core/motion';
import AccountMenu from './AccountMenu';
import { useSavedRooms } from './plans';
import ReferenceSvg from './ReferenceSvg';
import RoomPreview from './RoomPreview';
import RoomFloorPlan from './RoomFloorPlan';
import ErrorText from '../shared/ErrorText';
import './room-list.css';

const shapes: Record<RoomShape, string> = { square: '正方形に近い', standard: 'やや縦長', long: '細長い' };
const money = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

function roomDimensions(design: RoomDesign): string {
  const input = design.analysisInput;
  const room = design.room;
  const dimensions = room ? `${room.width.toFixed(1)} m × ${room.depth.toFixed(1)} m` : undefined;
  if (input) return `${input.tatami}畳 · ${shapes[input.shape]}${dimensions ? ` · ${dimensions}` : ''}`;
  if (!room) return '広さ・形状は未登録';
  const ratio = Math.max(room.width, room.depth) / Math.min(room.width, room.depth);
  const shape = ratio < 1.15 ? 'square' : ratio >= 1.8 ? 'long' : 'standard';
  return `${(room.width * room.depth).toFixed(1)} m² · ${shapes[shape]} · ${dimensions}`;
}

function RoomDetails({ room }: { room: SavedRoom }) {
  const design = room.design;
  const additions = design?.items.filter(item => !item.existing) ?? [];
  const unknownPrices = additions.filter(item => item.price === undefined).length;
  const total = additions.reduce((sum, item) => sum + (item.price ?? 0), 0);
  return <div className="room-list-details motion-enter" style={motionStaggerStyle(1)}>
    <div className="room-list-copy">
      <h2 id="selected-room-title">{room.title}</h2>
      {design ? <>
        <p className="room-list-dimensions">{roomDimensions(design)}</p>
        <dl className="room-list-finances">
          <div><dt>家具価格の合計（買い足し）</dt><dd>{unknownPrices ? `確認済み ${money(total)}` : money(total)}</dd></div>
          {design.budget !== undefined && <div><dt>予算</dt><dd>{money(design.budget)}</dd></div>}
        </dl>
        {unknownPrices > 0 && <p className="room-list-price-note">{unknownPrices}点の価格が未確認です。</p>}
        <Link className="room-list-open motion-control" to={`/rooms/${encodeURIComponent(design.id)}`}>この部屋を開く <span aria-hidden="true">↗</span></Link>
      </> : <p className="room-list-feedback" role="status">{room.status === 'analyzing' ? '部屋を作成しています…' : room.errorMessage || '部屋を作成できませんでした。'}</p>}
    </div>
    {design && <RoomFloorPlan design={design}/>}
  </div>;
}

export default function RoomListPage() {
  const rooms = useSavedRooms();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const foundIndex = rooms.data.findIndex(room => room.id === selectedId);
  const index = foundIndex < 0 ? 0 : foundIndex;
  const selected = rooms.data[index];
  function move(direction: number) {
    const next = rooms.data[(index + direction + rooms.data.length) % rooms.data.length];
    if (next) setSelectedId(next.id);
  }
  return <div className="room-list-page">
    <header className="room-list-header">
      <Link to="/rooms" className="room-list-brand"><ReferenceSvg page={2} index={0}/><span>へやいろ</span></Link>
      <Link className="rc-secondary" to="/room-templates">テンプレート</Link>
      <AccountMenu/>
    </header>
    <main className="room-list-main">
      <div className="room-list-heading"><h1>マイルーム</h1><Link to="/rooms/new" className="room-list-new motion-control"><span aria-hidden="true">＋</span> 新しいルームを作る</Link></div>
      {selected && <section className="room-list-carousel" aria-label="保存した部屋" aria-roledescription="カルーセル" tabIndex={0} onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
      }}>
        <div className="room-list-stage">
          <button className="room-list-arrow is-previous motion-control" type="button" aria-label="前の部屋" aria-controls="selected-room" disabled={rooms.data.length < 2} onClick={() => move(-1)}><span aria-hidden="true">‹</span></button>
          <div className="room-list-scene" key={selected.id}>
            {selected.design ? <RoomPreview design={selected.design}/> : <p className="room-list-pending" role="status">{selected.status === 'analyzing' ? '部屋を作成しています…' : '部屋を作成できませんでした。'}</p>}
          </div>
          <button className="room-list-arrow is-next motion-control" type="button" aria-label="次の部屋" aria-controls="selected-room" disabled={rooms.data.length < 2} onClick={() => move(1)}><span aria-hidden="true">›</span></button>
          <p className="room-list-position" aria-live="polite" aria-atomic="true">{index + 1} / {rooms.data.length}<span className="room-list-sr-only"> · {selected.title}</span></p>
        </div>
        <div id="selected-room" role="group" aria-roledescription="スライド" aria-labelledby="selected-room-title"><RoomDetails key={selected.id} room={selected}/></div>
      </section>}
      {!selected && !rooms.isLoading && !rooms.error && <div className="room-list-empty"><p>保存した部屋はまだありません。</p><Link className="motion-control" to="/rooms/new">最初の部屋を作る</Link></div>}
      {rooms.isLoading && <p className="room-list-feedback" role="status">読み込み中…</p>}
      {rooms.persistenceWarning && <p className="room-list-feedback" role="alert">{rooms.persistenceWarning}</p>}
      {rooms.error && <div className="room-list-feedback"><ErrorText error={rooms.error}/><button className="rc-secondary" type="button" onClick={() => void rooms.refetch()}>再試行</button></div>}
    </main>
  </div>;
}
