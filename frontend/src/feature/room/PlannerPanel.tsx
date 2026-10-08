import { useState, type DragEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRepositories } from '../../core/repositories';
import type { FurnitureCategory, RoomDesign, RoomItem } from '../../domain/room';
import ErrorText from '../shared/ErrorText';
import { downloadShoppingCsv } from './exports';
import { LAYOUT_GRID_STEP, snapItemPosition, snapToLayoutGrid } from './layoutGrid';
import { createFurnitureItem, FURNITURE_DRAG_TYPE, furnitureTemplates } from './furniturePlacement';
import { furniturePositionInRoom } from './roomBounds';
import './planner.css';

export type PlannerView = 'perspective' | 'top' | 'front';

type PlannerPanelProps = {
  design: RoomDesign;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (next: RoomDesign) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  onSave: () => void;
  onClose: () => void;
  onProducts: () => void;
  view: PlannerView;
  onView: (view: PlannerView) => void;
  dimensions: boolean;
  onDimensions: (value: boolean) => void;
  onAddItem: (item: RoomItem, position?: RoomItem['position']) => void;
  onDragItem: (item: RoomItem | null) => void;
  onRemoveItem: (id: string) => void;
  placementDisabled: boolean;
  placementHint?: string;
};

const itemColors = [
  ['#BBA5EE', 'ラベンダー'], ['#8A77B0', '落ち着いた紫'], ['#F4EFE6', 'アイボリー'],
  ['#73966C', 'グリーン'], ['#595163', 'チャコール'],
] as const;
const wallColors = [
  ['#D5CCDF', 'ラベンダー'], ['#F0ECE5', 'アイボリー'], ['#CCD7C8', '淡いグリーン'],
  ['#E5D2D7', '淡いピンク'], ['#C7D4E0', '淡いブルー'],
] as const;
const viewChoices = [['perspective', '立体'], ['top', '真上'], ['front', '正面']] as const;
const cm = (meters: number) => `${Math.round(meters * 1000) / 10}`;

function ArrowIcon({ redo = false }: { redo?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={redo ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function FurnitureIcon({ category }: { category: FurnitureCategory }) {
  const paths: Record<FurnitureCategory, string> = {
    sofa: 'M5 13V7h14v6M3 12h4v7h10v-7h4v9H3v-9M6 21v2m12-2v2M7 16h10',
    bed: 'M3 21V5m18 16V10H3m0 7h18M6 7h5v3H6V7m15 10v4',
    desk: 'M3 7h18v4H3V7m2 4v11m14-11v11M13 12h6v4h-6v-4',
    chair: 'M7 3h10v10H7V3m-2 10h14v4H5v-4m2 4v6m10-6v6',
    shelf: 'M5 2h14v20H5V2m0 7h14M5 16h14M8 22v2m8-2v2',
    table: 'M3 9h18v4H3V9m3 4v9m12-9v9',
  };
  return <svg width="36" height="36" viewBox="0 0 24 26" fill="none" aria-hidden="true"><path d={paths[category]} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const dimensionLabels = ['幅', '高さ', '奥行き'] as const;
const sizeValues = (size: RoomItem['size']) => size.map(cm);
const parseSize = (values: string[]): RoomItem['size'] => [Number(values[0]) / 100, Number(values[1]) / 100, Number(values[2]) / 100];

function furnitureLink(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return url.href;
  } catch { /* Invalid links are neither submitted nor rendered. */ }
  return undefined;
}

function FurniturePhoto({ item, compact = false }: { item: RoomItem; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = furnitureLink(item.imageUrl);
  return <span className={`rc-furniture-photo${compact ? ' rc-furniture-photo-compact' : ''}`}>
    {imageUrl && !failed
      ? <img src={imageUrl} alt={item.name} draggable={false} onError={() => setFailed(true)} />
      : <FurnitureIcon category={furnitureTemplates.find(candidate => candidate.category === item.category)?.category ?? 'table'} />}
  </span>;
}

function FurniturePalette({ design, disabled, hint, onAddItem, onDragItem, onView, view }: {
  design: RoomDesign;
  disabled: boolean;
  hint?: string;
  onAddItem: PlannerPanelProps['onAddItem'];
  onDragItem: PlannerPanelProps['onDragItem'];
  onView: PlannerPanelProps['onView'];
  view: PlannerView;
}) {
  const { rooms } = useRepositories();
  const [source, setSource] = useState<'link' | 'manual'>('link');
  const [link, setLink] = useState('');
  const submittedLink = furnitureLink(link.trim());
  const imported = useMutation({
    mutationFn: async (url: string) => ({ url, item: await rooms.importFurniture(url) }),
  });
  const linkedItem = imported.data && imported.data.url === submittedLink ? imported.data.item : undefined;
  const linkedItemFits = linkedItem ? Boolean(furniturePositionInRoom(linkedItem, linkedItem.position, design)) : false;
  const canAddLinkedItem = Boolean(linkedItem && linkedItemFits && !disabled && !imported.isPending);
  const productLink = furnitureLink(linkedItem?.productUrl);
  const [category, setCategory] = useState<FurnitureCategory>('sofa');
  const [values, setValues] = useState(() => sizeValues(furnitureTemplates[0].size));
  const size = parseSize(values);
  const template = furnitureTemplates.find(candidate => candidate.category === category)!;
  const valid = Boolean(furniturePositionInRoom({ size, rotation: 0 }, [0, size[1] / 2, 0], design));
  const inputError = !size.every(value => Number.isFinite(value) && value > 0)
    ? '幅・高さ・奥行きに0より大きい数値を入力してください。'
    : !valid ? 'この寸法では部屋に収まりません。家具の寸法を小さくしてください。' : undefined;

  function startItemDrag(event: DragEvent<HTMLButtonElement>, item: RoomItem) {
    if (disabled || !furniturePositionInRoom(item, item.position, design)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(FURNITURE_DRAG_TYPE, JSON.stringify(item));
    if (view === 'front') onView('top');
    onDragItem(item);
  }

  return <section className="rc-planner-section rc-furniture-palette" aria-labelledby="planner-add-label">
    <h3 id="planner-add-label">家具を追加</h3>
    <div className="rc-planner-segments rc-furniture-source" role="group" aria-label="家具の追加方法">
      <button type="button" aria-pressed={source === 'link'} onClick={() => setSource('link')}>リンクから追加</button>
      <button type="button" aria-pressed={source === 'manual'} onClick={() => setSource('manual')}>リンクなしで選ぶ</button>
    </div>
    {source === 'link' ? <div className="rc-furniture-link-panel">
      <form className="rc-furniture-link-form" onSubmit={event => { event.preventDefault(); if (submittedLink && !disabled && !imported.isPending) imported.mutate(submittedLink); }}>
        <label htmlFor="planner-product-link">商品リンク</label>
        <input id="planner-product-link" type="url" inputMode="url" placeholder="https://…" required value={link} disabled={disabled || imported.isPending} onChange={event => setLink(event.target.value)} />
        <button type="submit" disabled={disabled || !submittedLink || imported.isPending}>{imported.isPending ? '家具を作成中…' : 'リンクから家具を作成'}</button>
      </form>
      {imported.isPending && <p className="rc-planner-note" role="status">商品ページから家具の情報を取得しています。</p>}
      {imported.isError && imported.variables === submittedLink && <ErrorText error={imported.error} />}
      {linkedItem && <div className="rc-furniture-imported">
        <button className="rc-furniture-imported-card" type="button" disabled={!canAddLinkedItem} draggable={canAddLinkedItem} aria-label={`${linkedItem.name}を床へドラッグ、またはクリックして中央に追加`} onClick={() => { if (canAddLinkedItem) onAddItem(linkedItem); }} onDragStart={event => { if (canAddLinkedItem) startItemDrag(event, linkedItem); else event.preventDefault(); }} onDragEnd={() => onDragItem(null)}>
          <FurniturePhoto key={linkedItem.imageUrl ?? 'no-image'} item={linkedItem} />
          <span>{linkedItem.name}</span>
        </button>
        <dl className="rc-planner-size">{dimensionLabels.map((label, index) => <div key={label}><dt>{label}</dt><dd>{cm(linkedItem.size[index])}<span>cm</span></dd></div>)}</dl>
        {(linkedItem.price !== undefined || linkedItem.shop) && <p className="rc-furniture-product-meta">{linkedItem.price !== undefined && <span>¥{linkedItem.price.toLocaleString('ja-JP')}</span>}{linkedItem.shop && <span>{linkedItem.shop}</span>}</p>}
        {productLink && <a className="rc-furniture-product-link" href={productLink} target="_blank" rel="noopener noreferrer">商品ページを見る</a>}
        {!linkedItemFits && <p className="rc-planner-input-error" role="status">この家具は部屋の寸法に収まりません。</p>}
        <button className="rc-furniture-add" type="button" disabled={!canAddLinkedItem} onClick={() => { if (canAddLinkedItem) onAddItem(linkedItem); }}>＋ 部屋の中央に追加</button>
      </div>}
    </div> : <>
    <div className="rc-furniture-cards" role="group" aria-label="追加する家具を選ぶ">
      {furnitureTemplates.map(candidate => <button key={candidate.category} type="button" className="rc-furniture-card"
        disabled={disabled} draggable={!disabled} aria-pressed={category === candidate.category}
        aria-label={`${candidate.name}を選ぶ。床へドラッグして追加`}
        onClick={() => { if (category !== candidate.category) { setCategory(candidate.category); setValues(sizeValues(candidate.size)); } }}
        onDragStart={event => startItemDrag(event, createFurnitureItem(candidate.category, candidate.category === category ? size : undefined))} onDragEnd={() => onDragItem(null)}>
        <FurnitureIcon category={candidate.category} /><span>{candidate.name}</span>
      </button>)}
    </div>
    <fieldset className="rc-furniture-dimensions" disabled={disabled}>
      <legend>{template.name}の寸法（cm）</legend>
      <div>{dimensionLabels.map((label, index) => <label key={label}>{label}<input type="number" min="1" step="1" inputMode="decimal" value={values[index]} aria-invalid={Boolean(inputError)} onChange={event => setValues(previous => previous.map((value, axis) => axis === index ? event.target.value : value))} /></label>)}</div>
    </fieldset>
    {inputError && !disabled && <p className="rc-planner-input-error" role="status">{inputError}</p>}
    <button className="rc-furniture-add" type="button" disabled={disabled || !valid} onClick={() => onAddItem(createFurnitureItem(category, size))}>＋ 部屋の中央に追加</button>
    </>}
    {hint && <p className="rc-planner-warning" role="status">{hint}</p>}
  </section>;
}

function FurnitureSizeEditor({ item, design, onChange }: { item: RoomItem; design: RoomDesign; onChange: (change: Partial<RoomItem>) => void }) {
  const [values, setValues] = useState(() => sizeValues(item.size));
  const [error, setError] = useState<string>();

  function commit() {
    const size = parseSize(values);
    const resized = { ...item, size };
    const position = furniturePositionInRoom(resized, item.position, design);
    if (!position) {
      setError(size.every(value => Number.isFinite(value) && value > 0) ? 'この寸法と向きでは部屋に収まりません。' : '0より大きい数値を入力してください。');
      return;
    }
    setError(undefined);
    onChange({ size, position });
  }

  return <>
    <fieldset className="rc-furniture-dimensions">
      <legend>家具の寸法（cm）</legend>
      <div>{dimensionLabels.map((label, index) => <label key={label}>{label}<input type="number" min="1" step="1" inputMode="decimal" value={values[index]} aria-invalid={Boolean(error)} onChange={event => setValues(previous => previous.map((value, axis) => axis === index ? event.target.value : value))} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>)}</div>
    </fieldset>
    {error && <p className="rc-planner-input-error" role="status">{error}</p>}
  </>;
}

export default function PlannerPanel({ design, selectedId, onSelect, onChange, onUndo, onRedo, canUndo, canRedo, dirty, onSave, onClose, onProducts, view, onView, dimensions, onDimensions, onAddItem, onDragItem, onRemoveItem, placementDisabled, placementHint }: PlannerPanelProps) {
  const selected = design.items.find(item => item.id === selectedId);
  const selectedProductLink = furnitureLink(selected?.productUrl);
  const completeModel = Boolean(design.modelUrl && design.modelKind !== 'shell');
  const itemDisabled = !selected || completeModel;

  function changeItem(change: Partial<RoomItem>) {
    if (!selected || completeModel) return;
    onChange({ ...design, items: design.items.map(item => item.id === selected.id ? { ...item, ...change } : item) });
  }

  function move(axis: 0 | 2, step: number) {
    if (!selected) return;
    const position: RoomItem['position'] = [...selected.position];
    position[axis] = snapToLayoutGrid(position[axis]) + step;
    changeItem({ position: snapItemPosition(selected, position, [axis], design.room) });
  }

  function canRotate(degrees: number) {
    if (!selected) return false;
    if (!design.room) return true;
    const angle = ((selected.rotation ?? 0) + degrees) * Math.PI / 180;
    const width = Math.abs(Math.cos(angle)) * selected.size[0] + Math.abs(Math.sin(angle)) * selected.size[2];
    const depth = Math.abs(Math.sin(angle)) * selected.size[0] + Math.abs(Math.cos(angle)) * selected.size[2];
    return width <= design.room.width && depth <= design.room.depth;
  }

  function rotate(degrees: number) {
    if (!selected || !canRotate(degrees)) return;
    const rotation = ((selected.rotation ?? 0) + degrees + 360) % 360;
    const rotated = { ...selected, rotation };
    changeItem({ rotation, position: snapItemPosition(rotated, selected.position, [0, 2], design.room) });
  }

  return <aside className="rc-panel rc-planner" aria-label="配置を編集">
    <div className="rc-planner-heading">
      <div><h2>配置を編集</h2></div>
      <button className="rc-planner-close" type="button" aria-label="編集パネルを閉じる" onClick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
      </button>
    </div>
    <div className="rc-planner-content">
      <div className="rc-planner-history">
        <button type="button" onClick={onUndo} disabled={!canUndo}><ArrowIcon />元に戻す</button>
        <button type="button" onClick={onRedo} disabled={!canRedo}><ArrowIcon redo />やり直す</button>
      </div>
      <FurniturePalette design={design} disabled={placementDisabled || completeModel} hint={placementHint} onAddItem={onAddItem} onDragItem={onDragItem} view={view} onView={onView} />
      <section className="rc-planner-section" aria-labelledby="planner-view-label">
        <h3 id="planner-view-label">見え方</h3>
        <div className="rc-planner-segments" role="group" aria-label="視点を切り替える">
          {viewChoices.map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => onView(key)}>{label}</button>)}
        </div>
        <label className="rc-planner-check"><input type="checkbox" checked={dimensions} onChange={event => onDimensions(event.target.checked)} />選択した家具の寸法を表示</label>
      </section>
      <section className="rc-planner-section" aria-labelledby="planner-item-label">
        <label id="planner-item-label" className="rc-planner-label" htmlFor="planner-item">編集する家具</label>
        <select id="planner-item" value={selected?.id ?? ''} onChange={event => onSelect(event.target.value)}>
          <option value="" disabled>家具を選択してください</option>
          {design.items.map(item => <option key={item.id} value={item.id}>{item.name}{item.existing ? '（今ある家具）' : ''}</option>)}
        </select>
        {selected && <>
          {selected.imageUrl && <FurniturePhoto key={selected.imageUrl} item={selected} compact />}
          <dl className="rc-planner-size">
            {([['幅', 0], ['高さ', 1], ['奥行き', 2]] as const).map(([label, index]) => <div key={label}><dt>{label}</dt><dd>{cm(selected.size[index])}<span>cm</span></dd></div>)}
          </dl>
          {selectedProductLink && <a className="rc-furniture-product-link" href={selectedProductLink} target="_blank" rel="noopener noreferrer">商品ページを見る</a>}
          {selected.id.startsWith('manual-') && !completeModel && <>
            <FurnitureSizeEditor key={`${selected.id}:${selected.size.join(',')}`} item={selected} design={design} onChange={changeItem} />
            <button className="rc-furniture-remove" type="button" onClick={() => onRemoveItem(selected.id)}>追加した家具を削除</button>
          </>}
        </>}
        {completeModel && <p className="rc-planner-warning">家具を含む完成モデルのため、個別の移動・回転・色変更には対応していません。視点の切り替えは利用できます。</p>}
      </section>
      <fieldset className="rc-planner-section" disabled={itemDisabled}>
        <legend>位置を調整</legend>
        <div className="rc-planner-move">
          <span>左右（X）</span><button type="button" aria-label="X方向にマイナス10cm移動" onClick={() => move(0, -LAYOUT_GRID_STEP)}>−10cm</button><button type="button" aria-label="X方向にプラス10cm移動" onClick={() => move(0, LAYOUT_GRID_STEP)}>＋10cm</button>
          <span>前後（Z）</span><button type="button" aria-label="Z方向にマイナス10cm移動" onClick={() => move(2, -LAYOUT_GRID_STEP)}>−10cm</button><button type="button" aria-label="Z方向にプラス10cm移動" onClick={() => move(2, LAYOUT_GRID_STEP)}>＋10cm</button>
        </div>
        {selected && <p className="rc-planner-coordinate">X {cm(selected.position[0])}cm / Z {cm(selected.position[2])}cm</p>}
      </fieldset>
      <fieldset className="rc-planner-section" disabled={itemDisabled}>
        <legend>向きを調整</legend>
        <div className="rc-planner-rotation"><button type="button" onClick={() => rotate(-15)} disabled={!canRotate(-15)} aria-label="家具をマイナス15度回転">−15°</button><button type="button" onClick={() => rotate(15)} disabled={!canRotate(15)} aria-label="家具をプラス15度回転">＋15°</button><button type="button" onClick={() => rotate(90)} disabled={!canRotate(90)} aria-label="家具を90度回転">90°</button></div>
        {selected && <p className="rc-planner-coordinate">現在の角度 {selected.rotation ?? 0}°</p>}
      </fieldset>
      <fieldset className="rc-planner-section" disabled={itemDisabled}>
        <legend>家具の色</legend>
        <div className="rc-planner-swatches" role="group" aria-label="家具の色を選ぶ">
          {itemColors.map(([color, label]) => <button key={color} type="button" aria-label={`家具を${label}にする`} title={label} aria-pressed={selected?.color.toUpperCase() === color.toUpperCase()} style={{ backgroundColor: color }} onClick={() => changeItem({ color })} />)}
        </div>
      </fieldset>
      <fieldset className="rc-planner-section" disabled={completeModel}>
        <legend>壁の色</legend>
        <div className="rc-planner-swatches" role="group" aria-label="壁の色を選ぶ">
          {wallColors.map(([color, label]) => <button key={color} type="button" aria-label={`壁を${label}にする`} title={label} aria-pressed={design.wallColor?.toUpperCase() === color.toUpperCase()} style={{ backgroundColor: color }} onClick={() => onChange({ ...design, wallColor: color })} />)}
        </div>
      </fieldset>
    </div>
    <div className="rc-planner-footer">
      <button type="button" className="rc-primary" disabled={!dirty} onClick={onSave}>変更を保存</button>
      <div><button type="button" className="rc-secondary" onClick={onProducts}>アイテムを見る</button><button type="button" className="rc-secondary" onClick={() => downloadShoppingCsv(design.items, design.title)}>購入リストCSV</button></div>
    </div>
  </aside>;
}
