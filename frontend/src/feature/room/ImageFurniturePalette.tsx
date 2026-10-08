import { useRef, useState } from 'react';
import { type FurnitureCategory, type ImageArtwork, type RoomItem } from '../../domain/room';
import { createFurnitureItem, furnitureTemplates } from './furniturePlacement';
import { readArtwork } from './readArtwork';

export default function ImageFurniturePalette({ disabled, onImport }: { disabled: boolean; onImport: (item: RoomItem) => void }) {
  const [photo, setPhoto] = useState<ImageArtwork>();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FurnitureCategory>('chair');
  const [dimensions, setDimensions] = useState(['45', '80', '45']);
  const [color, setColor] = useState('#73966c');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const selection = useRef(0);
  const size: RoomItem['size'] = [Number(dimensions[0]) / 100, Number(dimensions[1]) / 100, Number(dimensions[2]) / 100];
  const valid = photo && name.trim() && size.every(value => Number.isFinite(value) && value > 0);

  async function selectPhoto(file?: File) {
    const request = ++selection.current;
    setPhoto(undefined); setError('');
    if (!file) { setPending(false); return; }
    setPending(true);
    try {
      const result = await readArtwork(file);
      if (request === selection.current) { setPhoto(result.artwork); setName(file.name.replace(/\.[^.]+$/, '').slice(0, 100)); }
    } catch (cause) { if (request === selection.current) setError(cause instanceof Error ? cause.message : '画像を取り込めませんでした。'); }
    finally { if (request === selection.current) setPending(false); }
  }

  return <form className="rc-image-furniture" onSubmit={event => {
    event.preventDefault();
    if (!valid || disabled || pending) return;
    try { onImport({ ...createFurnitureItem(category, size), name: name.trim(), color, referenceImage: photo }); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '家具を保存できませんでした。'); }
  }}>
    <label className="rc-image-goods-upload">家具の画像<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => { void selectPhoto(event.target.files?.[0]); }} /></label>
    <p className="rc-planner-note">JPEG・PNG・WebP、1枚10MBまで。画像は保存用に最大512pxへ縮小します。</p>
    <p className="rc-planner-note">家具の種類と寸法を指定してください。3Dでは種類別のモデルを使い、写真の形状を自動で再現しません。</p>
    {pending && <p role="status">画像を取り込み中…</p>}
    {photo && <span className="rc-furniture-photo"><img src={photo.dataUrl} alt={name || '取り込む家具'} /></span>}
    <label>家具の名前<input type="text" maxLength={100} required value={name} disabled={disabled || pending} onChange={event => setName(event.target.value)} /></label>
    <label>家具の種類<select value={category} disabled={disabled} onChange={event => {
      const next = furnitureTemplates.find(item => item.category === event.target.value)!;
      setCategory(next.category); setDimensions(next.size.map(value => String(Math.round(value * 100)))); setColor(next.color);
    }}>{furnitureTemplates.map(item => <option key={item.category} value={item.category}>{item.name}</option>)}</select></label>
    <fieldset className="rc-furniture-dimensions" disabled={disabled}><legend>家具の寸法（cm）</legend><div>{(['幅', '高さ', '奥行き'] as const).map((label, axis) => <label key={label}>{label}<input type="number" min="1" step="1" required value={dimensions[axis]} onChange={event => setDimensions(previous => previous.map((value, index) => index === axis ? event.target.value : value))} /></label>)}</div></fieldset>
    <label>モデルの色<input type="color" value={color} disabled={disabled} onChange={event => setColor(event.target.value)} /></label>
    {error && <p className="rc-planner-input-error" role="alert">{error}</p>}
    <button className="rc-furniture-add" type="submit" disabled={disabled || pending || !valid}>家具を一覧に取り込む</button>
  </form>;
}
