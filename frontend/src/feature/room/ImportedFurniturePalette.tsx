import { useState, type DragEvent } from 'react';
import type { RoomDesign, RoomItem } from '../../domain/room';
import { furnitureTemplates } from './furniturePlacement';
import { furniturePositionInRoom } from './roomBounds';
import type { useImportedFurniture } from './importedFurniture';
import ErrorText from '../shared/ErrorText';

type Library = ReturnType<typeof useImportedFurniture>;
const normalized = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja-JP');

export default function ImportedFurniturePalette({ design, disabled, library, onAddItem, onDragStart, onDragEnd }: {
  design: RoomDesign; disabled: boolean; library: Library;
  onAddItem: (item: RoomItem) => void; onDragStart: (event: DragEvent<HTMLButtonElement>, item: RoomItem) => void; onDragEnd: () => void;
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  const items = library.data.filter(item => {
    const category = furnitureTemplates.find(template => template.category === item.category)?.name ?? item.category;
    const text = normalized([item.name, category, item.category, item.shop, item.productUrl].filter(Boolean).join(' '));
    return terms.every(term => text.includes(term));
  });
  return <div className="rc-imported-furniture">
    <label htmlFor="imported-furniture-search">取り込んだ家具を検索</label>
    <input id="imported-furniture-search" type="search" placeholder="家具名・種類・ショップ" value={query} onChange={event => setQuery(event.target.value)} />
    {!library.authenticated && <p className="rc-planner-note" role="status">取り込んだ家具を保存・検索するにはログインしてください。</p>}
    {library.isPending && library.authenticated && <p role="status">読み込み中…</p>}
    <ErrorText error={library.error} />
    {error && <p className="rc-planner-input-error" role="alert">{error}</p>}
    <p className="rc-planner-note" role="status">{items.length}件 / 保存済み{library.data.length}件</p>
    {library.authenticated && !library.isPending && !library.error && items.length === 0 && <p className="rc-planner-note">{library.data.length ? '一致する家具がありません。' : '画像から家具を取り込むと、ここに表示します。'}</p>}
    {items.map(item => {
      const fits = Boolean(furniturePositionInRoom(item, [0, item.size[1] / 2, 0], design));
      const available = !disabled && fits;
      const image = item.referenceImage?.dataUrl ?? item.imageUrl;
      return <article key={item.id} className="rc-imported-furniture-entry">
        <button type="button" className="rc-furniture-imported-card" disabled={!available} draggable={available} aria-label={`${item.name}を床へドラッグ、またはクリックして中央に追加`} onClick={() => { if (available) onAddItem(item); }} onDragStart={event => { if (available) onDragStart(event, item); else event.preventDefault(); }} onDragEnd={onDragEnd}>
          {image && <span className="rc-furniture-photo"><img src={image} alt={item.name} draggable={false} /></span>}<span>{item.name}</span>
        </button>
        <p className="rc-planner-note">{item.size.map(value => Math.round(value * 100)).join(' × ')}cm{item.shop ? `・${item.shop}` : ''}</p>
        {!fits && <p className="rc-planner-input-error" role="status">この家具は部屋に収まりません。</p>}
        <div className="rc-imported-furniture-actions"><button type="button" disabled={!available} onClick={() => { if (available) onAddItem(item); }}>中央に追加</button><button type="button" onClick={() => {
          try { library.remove(item.id); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : '一覧から削除できませんでした。'); }
        }}>一覧から削除</button></div>
      </article>;
    })}
  </div>;
}
