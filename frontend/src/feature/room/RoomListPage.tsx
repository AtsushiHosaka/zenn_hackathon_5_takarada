import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { RoomDesign, RoomShape } from '../../domain/room';
import type { SavedRoom } from '../../domain/roomRepository';
import { motionStaggerStyle, prefersReducedMotion, useReducedMotion } from '../../core/motion';
import AccountMenu from './AccountMenu';
import { useRoomPlanScope, useSavedRooms } from './plans';
import ReferenceSvg from './ReferenceSvg';
import { useRoomSnapshots } from './useRoomSnapshots';
import ErrorText from '../shared/ErrorText';
import './room-list.css';

const shapes: Record<RoomShape, string> = { square: '正方形に近い', standard: 'やや縦長', long: '細長い' };
const money = (value: number) => `¥${value.toLocaleString('ja-JP')}`;
const roomPath = (design: RoomDesign) => `/rooms/${encodeURIComponent(design.id)}`;
const heroInterval = 5000;

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

function purchaseSummary(design: RoomDesign): string | undefined {
  const additions = design.items.filter(item => !item.existing);
  if (!additions.length) return undefined;
  const total = additions.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const unknown = additions.filter(item => item.price === undefined).length;
  return `買い足し ${money(total)}${unknown ? `（${unknown}点は価格未確認）` : ''}`;
}

// 3Dモデルを撮った写真。準備中は読み込み中の印を出す。
function RoomShot({ url }: { url: string | null | undefined }) {
  if (url) return <img src={url} alt="" draggable={false}/>;
  return <span className={`room-list-preview-placeholder${url === null ? ' is-unavailable' : ''}`} role="status" aria-label={url === null ? '3Dモデルを表示できませんでした' : '3Dモデルを読み込み中'}>{url === null ? '◇' : ''}</span>;
}

type ReadyRoom = SavedRoom & { design: RoomDesign };

// 横長の大きな写真が、自動で横に流れていく。
function RoomHero({ rooms, snapshot }: { rooms: ReadyRoom[]; snapshot: (design: RoomDesign) => string | null | undefined }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const current = Math.min(index, rooms.length - 1);
  function show(next: number) {
    const host = track.current;
    const slide = host?.children[(next + rooms.length) % rooms.length] as HTMLElement | undefined;
    if (host && slide) host.scrollTo({ left: slide.offsetLeft - (host.clientWidth - slide.clientWidth) / 2, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
  }
  const advance = useEffectEvent(() => show(current + 1));
  useEffect(() => {
    if (paused || reducedMotion || rooms.length < 2) return;
    const timer = window.setInterval(advance, heroInterval);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, rooms.length]);
  return <section className="room-hero" aria-label="保存した部屋" aria-roledescription="カルーセル" tabIndex={0}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(current + (event.key === 'ArrowLeft' ? -1 : 1)); }
    }}>
    <div ref={track} id="room-hero-track" className="room-hero-track" onScroll={event => {
      const host = event.currentTarget;
      const center = host.scrollLeft + host.clientWidth / 2;
      const distances = Array.from(host.children, child => Math.abs((child as HTMLElement).offsetLeft + (child as HTMLElement).clientWidth / 2 - center));
      setIndex(distances.indexOf(Math.min(...distances)));
    }}>
      {rooms.map((room, position) => <Link key={room.id} className="room-hero-slide" to={roomPath(room.design)} aria-roledescription="スライド" aria-current={position === current ? 'true' : undefined}>
        <RoomShot url={snapshot(room.design)}/>
        <span className="room-hero-caption"><strong>{room.title}</strong><span>{roomDimensions(room.design)}</span></span>
      </Link>)}
    </div>
    {rooms.length > 1 && <>
      <button className="room-list-arrow is-previous motion-control" type="button" aria-label="前の部屋" aria-controls="room-hero-track" onClick={() => show(current - 1)}><span aria-hidden="true">‹</span></button>
      <button className="room-list-arrow is-next motion-control" type="button" aria-label="次の部屋" aria-controls="room-hero-track" onClick={() => show(current + 1)}><span aria-hidden="true">›</span></button>
      <p className="room-list-position" aria-live="polite" aria-atomic="true">{current + 1} / {rooms.length}<span className="room-list-sr-only"> · {rooms[current].title}</span></p>
    </>}
  </section>;
}

function RoomCard({ room, index, snapshot }: { room: SavedRoom; index: number; snapshot: (design: RoomDesign) => string | null | undefined }) {
  const design = room.design;
  if (!design) return <article className="room-card is-pending motion-enter" style={motionStaggerStyle(index)}>
    <div className="room-card-image"><p role="status">{room.status === 'analyzing' ? '部屋を作成しています…' : room.errorMessage || '部屋を作成できませんでした。'}</p></div>
    <div className="room-card-body"><h3>{room.title}</h3></div>
  </article>;
  const purchases = purchaseSummary(design);
  return <Link className="room-card motion-enter" style={motionStaggerStyle(index)} to={roomPath(design)}>
    <div className="room-card-image"><RoomShot url={snapshot(design)}/><span className="room-card-open" aria-hidden="true">この部屋を開く ↗</span></div>
    <div className="room-card-body"><h3>{room.title}</h3><p>{roomDimensions(design)}</p>{purchases && <p>{purchases}</p>}</div>
  </Link>;
}

export default function RoomListPage() {
  const rooms = useSavedRooms();
  const scope = useRoomPlanScope();
  const ready = rooms.data.filter((room): room is ReadyRoom => Boolean(room.design));
  const { snapshot, studio } = useRoomSnapshots(ready.map(room => room.design), scope);
  return <div className="room-list-page">
    <header className="room-list-header">
      <Link to="/rooms" className="room-list-brand"><ReferenceSvg page={2} index={0}/><span>へやいろ</span></Link>
      <Link className="rc-secondary" to="/room-templates">テンプレート</Link>
      <AccountMenu/>
    </header>
    <main className="room-list-main">
      <div className="room-list-heading"><h1>マイルーム</h1><Link to="/rooms/new" className="room-list-new motion-control"><span aria-hidden="true">＋</span> 新しいルームを作る</Link></div>
      {ready.length > 0 && <RoomHero rooms={ready} snapshot={snapshot}/>}
      {rooms.data.length > 0 && <section className="room-card-section" aria-labelledby="room-card-heading">
        <h2 id="room-card-heading">すべての部屋</h2>
        <div className="room-card-grid">{rooms.data.map((room, index) => <RoomCard key={room.id} room={room} index={index} snapshot={snapshot}/>)}</div>
      </section>}
      {rooms.data.length === 0 && !rooms.isLoading && !rooms.error && <div className="room-list-empty"><p>保存した部屋はまだありません。</p><Link className="motion-control" to="/rooms/new">最初の部屋を作る</Link></div>}
      {rooms.isLoading && <p className="room-list-feedback" role="status">読み込み中…</p>}
      {rooms.persistenceWarning && <p className="room-list-feedback motion-fade" role="alert">{rooms.persistenceWarning}</p>}
      {rooms.error && <div className="room-list-feedback"><ErrorText error={rooms.error}/><button className="rc-secondary" type="button" onClick={()=>void rooms.refetch()}>再試行</button></div>}
    </main>
    {studio}
  </div>;
}
