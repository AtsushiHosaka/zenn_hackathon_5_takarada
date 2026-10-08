import { useRef, useState, type DragEvent } from 'react';
import { type ImageArtwork, type ImageGoodsCategory, type RoomDesign, type RoomItem } from '../../domain/room';
import { furniturePositionInRoom } from './roomBounds';
import { readArtwork } from './readArtwork';

const labels: Record<ImageGoodsCategory, string> = { poster: 'ポスター', acrylic_stand: 'アクリルスタンド' };


export default function ImageGoodsPalette({ design, disabled, onAddItem, onDragStart, onDragEnd }: {
  design: RoomDesign;
  disabled: boolean;
  onAddItem: (item: RoomItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: RoomItem) => void;
  onDragEnd: () => void;
}) {
  const [kind, setKind] = useState<ImageGoodsCategory>('poster');
  const [image, setImage] = useState<{ artwork: ImageArtwork; aspect: number; name: string }>();
  const [heightCm, setHeightCm] = useState('60');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const selection = useRef(0);
  const height = Number(heightCm) / 100;
  const size: RoomItem['size'] = [height * (image?.aspect ?? 1), height, kind === 'poster' ? .02 : Math.max(.04, height * .3)];
  const item: RoomItem | undefined = image ? {
    id: `manual-${crypto.randomUUID()}`, name: `${labels[kind]}・${image.name}`.slice(0, 100), category: kind,
    existing: true, color: '#ffffff', size, position: [0, height / 2, 0], rotation: 0, artwork: image.artwork,
  } : undefined;
  const fits = item && height > 0 && Boolean(furniturePositionInRoom(item, item.position, design));
  const available = Boolean(item && fits && !disabled && !pending);

  async function selectFile(file?: File) {
    const request = ++selection.current;
    setImage(undefined); setError('');
    if (!file) { setPending(false); return; }
    setPending(true);
    try {
      const result = await readArtwork(file);
      if (request === selection.current) setImage({ ...result, name: file.name.replace(/\.[^.]+$/, '') });
    } catch (cause) {
      if (request === selection.current) setError(cause instanceof Error ? cause.message : '画像を取り込めませんでした。');
    } finally { if (request === selection.current) setPending(false); }
  }

  return <div className="rc-image-goods">
    <div className="rc-planner-segments" role="group" aria-label="推しグッズの種類">
      {(['poster', 'acrylic_stand'] as const).map(value => <button key={value} type="button" disabled={disabled} aria-pressed={kind === value} onClick={() => { setKind(value); setHeightCm(value === 'poster' ? '60' : '20'); }}>{labels[value]}</button>)}
    </div>
    <label className="rc-image-goods-upload">グッズに使う画像<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => { void selectFile(event.target.files?.[0]); }} /></label>
    <p className="rc-planner-note">JPEG・PNG・WebP、1枚10MBまで。保存用に最大512pxへ縮小します。</p>
    {kind === 'acrylic_stand' && <p className="rc-planner-note">透過画像は背景を透かして表示します。背景の自動切り抜きは行いません。</p>}
    {pending && <p className="rc-planner-note" role="status">画像を取り込み中…</p>}
    {error && <p className="rc-planner-input-error" role="alert">{error}</p>}
    {image && item && <>
      <button type="button" className="rc-furniture-imported-card" disabled={!available} draggable={available} aria-label={`${labels[kind]}を床へドラッグ、またはクリックして中央に追加`} onClick={() => { if (available) onAddItem(item); }} onDragStart={event => { if (available) onDragStart(event, item); else event.preventDefault(); }} onDragEnd={onDragEnd}>
        <span className="rc-furniture-photo rc-image-goods-preview"><img src={image.artwork.dataUrl} alt={image.name} draggable={false} /></span><span>{labels[kind]}</span>
      </button>
      <label className="rc-image-goods-height">高さ（cm）<input type="number" min="1" step="1" disabled={disabled} value={heightCm} onChange={event => setHeightCm(event.target.value)} /></label>
      <p className="rc-planner-note">幅 {Number.isFinite(size[0]) ? Math.round(size[0] * 100) : '—'}cm。画像の縦横比を保ちます。</p>
      {!fits && <p className="rc-planner-input-error" role="status">高さに正の数を入力し、部屋に収まる大きさにしてください。</p>}
      <button type="button" className="rc-furniture-add" disabled={!available} onClick={() => { if (available) onAddItem(item); }}>＋ {labels[kind]}を中央に追加</button>
    </>}
  </div>;
}
