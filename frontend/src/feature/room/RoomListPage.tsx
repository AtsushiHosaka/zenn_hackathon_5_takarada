import { Link } from 'react-router';
import type { RoomDesign, RoomShape } from '../../domain/room';
import AccountMenu from './AccountMenu';
import { useSavedRooms } from './plans';
import ReferenceSvg from './ReferenceSvg';
import RoomPreview from './RoomPreview';
import ErrorText from '../shared/ErrorText';
import './room-list.css';

const shapes: Record<RoomShape,string> = { square: '正方形に近い', standard: 'やや縦長', long: '細長い' };
const money = (value: number) => `¥${value.toLocaleString('ja-JP')}`;
function productTotal(design: RoomDesign | undefined): number | undefined {
  const additions = design?.items.filter(item => !item.existing) ?? [];
  return design?.kind === 'coordination' && additions.length > 0 && additions.every(item => item.price !== undefined)
    ? additions.reduce((sum,item) => sum + (item.price ?? 0),0) : undefined;
}

export default function RoomListPage() {
  const rooms = useSavedRooms();
  const showsTotals = rooms.data.some(room => productTotal(room.design) !== undefined);
  return <div className={`room-list-page${showsTotals ? ' has-product-totals' : ''}`}>
    <header className="room-list-header">
      <Link to="/rooms" className="room-list-brand"><ReferenceSvg page={2} index={0}/><span>へやいろ</span></Link>
      <AccountMenu/>
    </header>
    <main className="room-list-main">
      <h1>マイルーム</h1>
      <div className="room-list-grid">
        <Link to="/rooms/new" className="room-list-new-card" aria-label="新しいルームを作る" title="新しいルームを作る">
          <span className="room-list-new-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>
        </Link>
        {rooms.data.map(room => {
          const design = room.design;
          const budget = design?.budget;
          const total = productTotal(design);
          const card = <>
            <div className="room-list-scene">
              {design && <RoomPreview design={design}/>}
              {design && <Link className="room-list-open" to={`/rooms/${encodeURIComponent(design.id)}`} aria-label={`${room.title}を開く`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></Link>}
              {room.status !== 'ready' && <span className="room-list-status" role="status">{room.status === 'analyzing' ? '作成中' : '作成に失敗'}</span>}
            </div>
            <Link to={`/rooms/${encodeURIComponent(design?.id ?? room.id)}`} className="room-list-card-copy" aria-label={room.title} aria-disabled={!design} tabIndex={design ? undefined : -1} onClick={event => { if (!design) event.preventDefault(); }}>
              <span className="room-list-card-title">{room.title}</span>
              {design && <div className="room-list-specs">
                {design.analysisInput && <><span>{design.analysisInput.tatami}畳</span><span>{shapes[design.analysisInput.shape]}</span></>}
                <span>{design.items.length}アイテム</span>
              </div>}
              {(budget !== undefined || total !== undefined) && <div className="room-list-finances">
                {budget !== undefined && <span className="room-list-budget">予算 {money(budget)}</span>}
                {total !== undefined && <span className="room-list-total">商品計 {money(total)}</span>}
              </div>}
            </Link>
          </>;
          return <div key={room.id} className={`room-list-card${design ? '' : ' is-pending'}`}>{card}</div>;
        })}
      </div>
      {rooms.isLoading && <p className="room-list-feedback" role="status">読み込み中…</p>}
      {rooms.error && <div className="room-list-feedback"><ErrorText error={rooms.error}/><button className="rc-secondary" type="button" onClick={()=>void rooms.refetch()}>再試行</button></div>}
    </main>
  </div>;
}
