import { useState } from 'react';
import { Link } from 'react-router';
import type { RoomDesign } from '../../domain/room';
import AccountMenu from './AccountMenu';
import { useRoomPlans } from './plans';
import ReferenceSvg from './ReferenceSvg';
import './room-list.css';

type RoomCard = {
  id: string;
  title: string;
  description: string;
  image: number;
  count: number;
  updated: string;
  generating?: boolean;
};

const sampleRooms: RoomCard[] = [
  { id: 'sample-oshi', title: '紫の推し活ルーム', description: 'ラグを140cmのラウンド型に変更しました。', image: 5, count: 8, updated: '2時間前' },
  { id: 'sample-botanical', title: 'ボタニカルなワンルーム', description: '日当たりが弱い窓際でも育てやすい植物に入れ替えました。', image: 6, count: 11, updated: '昨日' },
  { id: 'sample-natural', title: '白×木目のナチュラル', description: '今のローテーブルに合わせて、照明を白で揃えました。', image: 7, count: 6, updated: '3日前' },
  { id: 'sample-game', title: 'ゲーム配信できる部屋', description: 'インテリアを選定しています…', image: 8, count: 0, updated: 'たった今', generating: true },
];

function savedRoomCard(room: RoomDesign): RoomCard {
  return {
    id: room.id,
    title: room.title,
    description: room.description,
    image: room.style === 'oshi' ? 5 : room.style === 'botanical' ? 6 : 7,
    count: room.items.filter(item => !item.existing).length,
    updated: '保存済み',
  };
}

export default function RoomListPage() {
  const [search, setSearch] = useState('');
  const plans = useRoomPlans();
  const rooms = [...plans.map(savedRoomCard), ...sampleRooms];
  const query = search.trim().toLocaleLowerCase('ja-JP');
  const filtered = rooms.filter(room => `${room.title} ${room.description}`.toLocaleLowerCase('ja-JP').includes(query));

  return <div className="room-list-page">
    <header className="room-list-header">
      <Link to="/rooms" className="room-list-brand">
        <ReferenceSvg page={2} index={0} />
        <span>Room Coordinator</span>
      </Link>
      <AccountMenu />
    </header>
    <main className="room-list-main">
      <div className="room-list-heading">
        <div className="room-list-intro">
          <h1>マイルーム<span>{rooms.length}</span></h1>
          <p>部屋の情報と希望から、コーディネートを3Dで確認。</p>
        </div>
        <div className="room-list-actions">
          <div className="room-list-search">
            <label htmlFor="room-search">ルームを検索</label>
            <ReferenceSvg page={2} index={2} />
            <input id="room-search" type="search" placeholder="ルームを検索" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <Link to="/rooms/new" className="room-list-create"><ReferenceSvg page={2} index={3} />新しいルーム</Link>
        </div>
      </div>
      <div className="room-list-grid">
        <Link to="/rooms/new" className="room-list-new-card">
          <span className="room-list-new-icon"><ReferenceSvg page={2} index={4} /></span>
          <span className="room-list-new-title">新しいルームを作る</span>
          <span className="room-list-new-description">部屋の情報と、どんな部屋にしたいかを入力します。</span>
        </Link>
        {filtered.map(room => <Link key={room.id} to={`/rooms/${encodeURIComponent(room.id)}`} className="room-list-card" aria-label={`${room.title}${room.id.startsWith('sample-') ? '（サンプル）' : ''}`}>
          <div className={`room-list-scene${room.generating ? ' room-list-generating' : ''}`}>
            <div className="room-list-scene-image"><ReferenceSvg page={2} index={room.image} /></div>
            {room.generating ? <>
              <span className="room-list-count room-list-generating-badge"><span />生成中</span>
              <div className="room-list-progress"><div /></div>
            </> : <span className="room-list-count">{room.count}アイテム</span>}
          </div>
          <div className="room-list-card-copy">
            <div className="room-list-card-title"><span>{room.title}</span><span>{room.updated}</span></div>
            <span className="room-list-card-description">{room.description}</span>
          </div>
        </Link>)}
      </div>
      {query && filtered.length === 0 && <p className="room-list-empty" role="status">「{search}」に一致するルームはありません。</p>}
    </main>
  </div>;
}
