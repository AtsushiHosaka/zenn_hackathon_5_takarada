import { useRef, useState, type DragEvent } from 'react';
import { isManualFurniture, isTemplateFurniture, productCategories, type ManualFurnitureCategory, type FurnitureAddition, type FurnitureOperation, type RoomDesign, type RoomItem } from '../../domain/room';
import FurnitureAdditionRows from './FurnitureAdditionRows';
import { downloadShoppingCsv } from './exports';
import { createFurnitureItem, FURNITURE_DRAG_TYPE, furnitureTemplates } from './furniturePlacement';
import { canPlaceOnFurniture, getFurniturePlacementBounds, furniturePositionInRoom, snapFurnitureEditPosition } from './roomBounds';
import ImageGoodsPalette from './ImageGoodsPalette';
import ImageFurniturePalette from './ImageFurniturePalette';
import ImportedFurniturePalette from './ImportedFurniturePalette';
import { useImportedFurniture } from './importedFurniture';
import { useRoomPlanScope } from './plans';
import './planner.css';
import FurnitureSearchPanel from './FurnitureSearchPanel';
import { productReplacementPosition } from './productReplacement';

export type PlannerView = 'perspective' | 'top' | 'front';

function isProductCategory(category: string) {
  const aliases: Record<string, string> = { lamp: 'floor_lamp', artwork: 'wall_art', cover: 'bed_cover' };
  return productCategories.some(value => value === (aliases[category] ?? category));
}

type PlannerPanelProps = {
  design: RoomDesign;
  templateEditing?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  furnitureRequests?: {
    existingItems: RoomItem[];
    operations: FurnitureOperation[];
    additions: FurnitureAddition[];
    onOperationChange: (objectId: string, action: FurnitureOperation['action']) => void;
    onAdditionsChange: (additions: FurnitureAddition[]) => void;
  };
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
  ['#F4F1EA', 'ホワイト'], ['#D8C2A0', 'ベージュ'], ['#C08F5B', 'ナチュラルウッド'], ['#6F4A2C', 'ブラウン'],
  ['#9A9CA3', 'グレー'], ['#2B2C31', 'ブラック'], ['#2F4E86', 'ネイビー'], ['#3C86E0', 'ブルー'],
  ['#4C9A62', 'グリーン'], ['#F0BE3C', 'イエロー'], ['#D6423A', 'レッド'], ['#E78BA3', 'ピンク'],
] as const;
const wallColors = [
  ['#D5CCDF', 'ラベンダー'], ['#F0ECE5', 'アイボリー'], ['#CCD7C8', '淡いグリーン'],
  ['#E5D2D7', '淡いピンク'], ['#C7D4E0', '淡いブルー'],
] as const;
const viewChoices = [['perspective', '立体'], ['top', '真上'], ['front', '正面']] as const;
const cm = (meters: number) => `${Math.round(meters * 1000) / 10}`;
const furnitureSources = [['search', '登録家具から探す'], ['manual', '種類と寸法で選ぶ'], ['library', '取り込んだ家具'], ['photo', '画像から家具'], ['image', '画像から推しグッズ']] as const;
const plannerTabs = [['add', '家具を追加'], ['item', '選んだ家具'], ['room', '部屋']] as const;
type PlannerTab = typeof plannerTabs[number][0];

function ArrowIcon({ redo = false }: { redo?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={redo ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function RotateIcon({ clockwise = false }: { clockwise?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={clockwise ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function FurnitureIcon({ category }: { category: ManualFurnitureCategory }) {
  const paths: Record<ManualFurnitureCategory, string> = {
    mirror: 'M5 2h14v21H5V2m3 3h8v15H8V5m1 12 5-8m-5 3 3-5',
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
  const imageUrl = item.referenceImage?.dataUrl ?? item.artwork?.dataUrl ?? furnitureLink(item.imageUrl);
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
  const [source, setSource] = useState<'manual' | 'search' | 'image' | 'photo' | 'library'>('search');
  const library = useImportedFurniture();
  const [libraryError, setLibraryError] = useState('');
  const [category, setCategory] = useState<ManualFurnitureCategory>('sofa');
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

  return <section className="rc-planner-section rc-furniture-palette" aria-label="家具を追加">
    {source === 'photo' && !library.authenticated && <p className="rc-planner-note" role="status">画像から家具を取り込むにはログインしてください。</p>}
    {libraryError && <p className="rc-planner-input-error" role="alert">{libraryError}</p>}
    <label className="rc-planner-label" htmlFor="planner-add-source">追加の方法</label>
    <select id="planner-add-source" value={source} onChange={event => setSource(event.target.value as typeof source)}>
      {furnitureSources.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
    {source === 'search' ? <FurnitureSearchPanel design={design} disabled={disabled} onAddItem={onAddItem}/> : source === 'photo' ? <ImageFurniturePalette disabled={disabled || !library.authenticated} onImport={item => { library.register(item); setSource('library'); setLibraryError(''); }} /> : source === 'library' ? <ImportedFurniturePalette key={library.scope} design={design} disabled={disabled} library={library} onAddItem={onAddItem} onDragStart={startItemDrag} onDragEnd={() => onDragItem(null)} /> : source === 'image' ? <ImageGoodsPalette design={design} disabled={disabled} onAddItem={onAddItem} onDragStart={startItemDrag} onDragEnd={() => onDragItem(null)} /> : <>
    <div className="rc-furniture-cards motion-control" role="group" aria-label="追加する家具を選ぶ">
      {furnitureTemplates.map(candidate => <button key={candidate.category} type="button" className="rc-furniture-card motion-control"
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
    {category === 'mirror' && <p className="rc-planner-note">鏡は正面の部屋を反射します。反射したい方向へ回転してください。</p>}
    <button className="rc-furniture-add motion-control" type="button" disabled={disabled || !valid} onClick={() => onAddItem(createFurnitureItem(category, size))}>＋ 部屋の中央に追加</button>
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
    const requested = [...item.position] as RoomItem['position'];
    if (canPlaceOnFurniture(resized)) requested[1] = item.position[1] - item.size[1] / 2 + size[1] / 2;
    const position = furniturePositionInRoom(resized, requested, design);
    if (!position) {
      setError(size.every(value => Number.isFinite(value) && value > 0) ? 'この寸法と向きでは部屋に収まりません。' : '0より大きい数値を入力してください。');
      return;
    }
    setError(undefined);
    if (item.artwork && item.category === 'poster') position[1] = Math.min(getFurniturePlacementBounds(design).max[1] - size[1] / 2, Math.max(position[1], item.position[1] - item.size[1] / 2 + size[1] / 2));
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

export default function PlannerPanel({ design, templateEditing=false, selectedId, onSelect, furnitureRequests, onChange, onUndo, onRedo, canUndo, canRedo, dirty, onSave, onClose, onProducts, view, onView, dimensions, onDimensions, onAddItem, onDragItem, onRemoveItem, placementDisabled, placementHint }: PlannerPanelProps) {
  const additionButton = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<PlannerTab>(selectedId ? 'item' : 'add');
  const [seenSelectedId, setSeenSelectedId] = useState(selectedId);
  if (seenSelectedId !== selectedId) {
    setSeenSelectedId(selectedId);
    if (selectedId) setTab('item');
  }
  const paletteScope = useRoomPlanScope();
  const selectableItems = [...design.items, ...(furnitureRequests?.existingItems ?? []).filter(item => !design.items.some(current => current.id === item.id))];
  const selected = selectableItems.find(item => item.id === selectedId);
  const detectedItems = furnitureRequests?.existingItems.filter(item => !isManualFurniture(item) && !isTemplateFurniture(item)) ?? [];
  const selectedProductLink = furnitureLink(selected?.productUrl);
  const completeModel = Boolean(design.modelUrl && design.modelKind !== 'shell');
  const itemDisabled = !selected || !design.items.some(item => item.id === selected.id) || completeModel;

  function changeItem(change: Partial<RoomItem>) {
    if (itemDisabled || !selected) return;
    onChange({ ...design, items: design.items.map(item => item.id === selected.id ? { ...item, ...change } : item) });
  }

  function canRotate(degrees: number) {
    if (!selected) return false;
    if (!design.room) return !isManualFurniture(selected) || Boolean(snapFurnitureEditPosition({ ...selected, rotation: ((selected.rotation ?? 0) + degrees + 360) % 360 }, selected.position, [0, 2], design));
    const angle = ((selected.rotation ?? 0) + degrees) * Math.PI / 180;
    const width = Math.abs(Math.cos(angle)) * selected.size[0] + Math.abs(Math.sin(angle)) * selected.size[2];
    const depth = Math.abs(Math.sin(angle)) * selected.size[0] + Math.abs(Math.cos(angle)) * selected.size[2];
    return width <= design.room.width && depth <= design.room.depth;
  }

  function rotate(degrees: number) {
    if (!selected || !canRotate(degrees)) return;
    const rotation = ((selected.rotation ?? 0) + degrees + 360) % 360;
    const rotated = { ...selected, rotation };
    const position = snapFurnitureEditPosition(rotated, selected.position, [0, 2], design);
    if (position) changeItem({ rotation, position });
  }

  return <aside className="rc-panel rc-planner" aria-label="配置を編集">
    <div className="rc-planner-heading">
      <h2>配置を編集</h2>
      <div className="rc-planner-heading-actions">
        <button className="rc-planner-icon motion-control" type="button" aria-label="元に戻す" title="元に戻す" onClick={onUndo} disabled={!canUndo}><ArrowIcon /></button>
        <button className="rc-planner-icon motion-control" type="button" aria-label="やり直す" title="やり直す" onClick={onRedo} disabled={!canRedo}><ArrowIcon redo /></button>
        <button className="rc-planner-icon motion-control" type="button" aria-label="編集パネルを閉じる" title="閉じる" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
    <div className="rc-planner-tabs" role="tablist" aria-label="編集メニュー">
      {plannerTabs.map(([key, label]) => <button key={key} id={`planner-tab-${key}`} type="button" role="tab" aria-selected={tab === key} aria-controls={`planner-tabpanel-${key}`} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    <div className="rc-planner-content">
      <div role="tabpanel" id="planner-tabpanel-add" aria-labelledby="planner-tab-add" hidden={tab !== 'add'}>
        <FurniturePalette key={paletteScope} design={design} disabled={placementDisabled || completeModel} hint={placementHint} onAddItem={onAddItem} onDragItem={onDragItem} view={view} onView={onView} />
      </div>
      <div role="tabpanel" id="planner-tabpanel-item" aria-labelledby="planner-tab-item" hidden={tab !== 'item'}>
        <section className="rc-planner-section">
          <label className="rc-planner-label" htmlFor="planner-item">編集する家具</label>
          <select id="planner-item" value={selected?.id ?? ''} onChange={event => onSelect(event.target.value)}>
            <option value="" disabled>家具を選択してください</option>
            {selectableItems.map(item => <option key={item.id} value={item.id}>{item.name}{item.existing ? '（今ある家具）' : ''}</option>)}
          </select>
          {!selected && <p className="rc-planner-note rc-planner-hint">部屋の中の家具をクリックするか、上の一覧から選んでください。</p>}
        </section>
        {completeModel && <p className="rc-planner-warning">家具を含む完成モデルのため、個別の移動・回転・色変更には対応していません。視点の切り替えは「部屋」から使えます。</p>}
        {selected && <>
          <div className="rc-planner-summary">
            {(selected.imageUrl || selected.referenceImage) && <FurniturePhoto key={selected.imageUrl ?? selected.referenceImage?.dataUrl} item={selected} compact />}
            <p className="rc-planner-size">幅 {cm(selected.size[0])} × 高さ {cm(selected.size[1])} × 奥行き {cm(selected.size[2])} cm</p>
            {selectedProductLink && <a className="rc-furniture-product-link" href={selectedProductLink} target="_blank" rel="noopener noreferrer">商品ページを見る</a>}
          </div>
          <fieldset className="rc-planner-section" disabled={itemDisabled}>
            <legend>向き（90°ずつ）<small>現在 {selected.rotation ?? 0}°</small></legend>
            <div className="rc-planner-rotation">
              <button className="motion-control" type="button" onClick={() => rotate(90)} disabled={!canRotate(90)} aria-label="家具を左へ90度回転"><RotateIcon />左へ90°</button>
              <button className="motion-control" type="button" onClick={() => rotate(-90)} disabled={!canRotate(-90)} aria-label="家具を右へ90度回転"><RotateIcon clockwise />右へ90°</button>
            </div>
          </fieldset>
          <fieldset className="rc-planner-section" disabled={itemDisabled}>
            <legend>色（3Dプレビュー）</legend>
            <div className="rc-planner-swatches" role="group" aria-label="家具の色を選ぶ">
              {itemColors.map(([color, label]) => <button className="motion-control" key={color} type="button" aria-label={`家具を${label}にする`} title={label} aria-pressed={selected.color.toUpperCase() === color.toUpperCase()} style={{ backgroundColor: color }} onClick={() => changeItem({ color, previewColor: color })} />)}
            </div>
            {selected.productUrl && <p className="rc-planner-note">色を変えるのはプレビューだけです。商品の色違いは「商品を置き換える」で選べます。</p>}
          </fieldset>
          {selected.artwork && !itemDisabled && <label className="rc-image-goods-height">床からの高さ（cm）<input type="number" min="0" max={Math.floor((getFurniturePlacementBounds(design).max[1] - getFurniturePlacementBounds(design).floor - selected.size[1]) * 100)} step="1" value={Math.round((selected.position[1] - selected.size[1] / 2 - getFurniturePlacementBounds(design).floor) * 100)} onChange={event => {
            const bottom = Number(event.target.value) / 100;
            const bounds = getFurniturePlacementBounds(design);
            if (!Number.isFinite(bottom) || bottom < 0 || bounds.floor + bottom + selected.size[1] > bounds.max[1]) return;
            changeItem({ supportObjectId: undefined, supportSurface: undefined, position: [selected.position[0], bounds.floor + bottom + selected.size[1] / 2, selected.position[2]] });
          }} /></label>}
          {isProductCategory(selected.category) && <details className="rc-planner-fold">
            <summary>商品を置き換える</summary>
            <FurnitureSearchPanel key={`${selected.id}:${selected.productMetadata?.variantId ?? selected.productUrl ?? selected.name}`} replacementTarget={selected} design={design} disabled={itemDisabled} onAddItem={product => {
              const position = productReplacementPosition(product, selected, design);
              if (!position) return;
              const { furnitureDetailId, ...details } = product;
              const replacement: RoomItem = { ...details, id: selected.id, existing: false, position, rotation: selected.rotation, marker: selected.marker, ...((selected.replacesObjectId || selected.existing) ? { replacesObjectId: selected.replacesObjectId ?? selected.id } : {}), furnitureDetailId, ...(!isManualFurniture(selected) ? { productId: String(1_000_000_000 + Number(furnitureDetailId)) } : {}) };
              const originalId = selected.replacesObjectId ?? (selected.existing ? selected.id : undefined);
              if (originalId && furnitureRequests) furnitureRequests.onOperationChange(originalId, 'replace');
              const operations = design.furnitureOperations ?? furnitureRequests?.operations ?? (design.before?.items ?? design.items).filter(item => item.existing).map(item => ({ objectId: item.id, action: 'keep' as const }));
              const nextOperations: FurnitureOperation[] = originalId ? [...operations.filter(operation => operation.objectId !== originalId), { objectId: originalId, action: 'replace' }] : operations;
              onChange({ ...design, ...(selected.existing && !design.before && design.room ? { before: { room: design.room, items: design.items, wallColor: design.wallColor } } : {}), items: design.items.map(item => item.id === selected.id ? replacement : item), ...(originalId ? { furnitureOperations: nextOperations, keptObjectIds: nextOperations.filter(operation => operation.action === 'keep').map(operation => operation.objectId) } : {}) });
            }} />
          </details>}
          {(selected.id.startsWith('manual-') || templateEditing) && !completeModel && <>
            {!itemDisabled && <details className="rc-planner-fold">
              <summary>寸法を変える</summary>
              <FurnitureSizeEditor key={`${selected.id}:${selected.size.join(',')}`} item={selected} design={design} onChange={changeItem} />
            </details>}
            <button className="rc-furniture-remove motion-control" type="button" onClick={() => onRemoveItem(selected.id)}>{templateEditing ? '家具を削除' : '追加した家具を削除'}</button>
          </>}
        </>}
      </div>
      <div role="tabpanel" id="planner-tabpanel-room" aria-labelledby="planner-tab-room" hidden={tab !== 'room'}>
        <section className="rc-planner-section" aria-labelledby="planner-view-label">
          <h3 id="planner-view-label">見え方</h3>
          <div className="rc-planner-segments" role="group" aria-label="視点を切り替える">
            {viewChoices.map(([key, label]) => <button className="motion-control" key={key} type="button" aria-pressed={view === key} onClick={() => onView(key)}>{label}</button>)}
          </div>
          <label className="rc-planner-check"><input type="checkbox" checked={dimensions} onChange={event => onDimensions(event.target.checked)} />選んだ家具の寸法を表示</label>
        </section>
        <fieldset className="rc-planner-section" disabled={completeModel}>
          <legend>壁の色</legend>
          <div className="rc-planner-swatches" role="group" aria-label="壁の色を選ぶ">
            {wallColors.map(([color, label]) => <button className="motion-control" key={color} type="button" aria-label={`壁を${label}にする`} title={label} aria-pressed={design.wallColor?.toUpperCase() === color.toUpperCase()} style={{ backgroundColor: color }} onClick={() => onChange({ ...design, wallColor: color })} />)}
          </div>
        </fieldset>
        <fieldset className="rc-planner-section" disabled={completeModel}>
          <legend>床の色</legend>
          <div className="rc-planner-swatches" role="group" aria-label="床の色を選ぶ">
            {wallColors.map(([color, label]) => <button className="motion-control" key={color} type="button" aria-label={`床を${label}にする`} title={label} aria-pressed={(design.floorColor ?? design.room?.floorColor)?.toUpperCase() === color.toUpperCase()} style={{ backgroundColor: color }} onClick={() => onChange({ ...design, floorColor: color })} />)}
          </div>
          <label className="rc-planner-floor-color">自由に選ぶ<input type="color" aria-label="床の色を自由に選ぶ" value={design.floorColor ?? design.room?.floorColor ?? '#D9BF99'} onChange={event => onChange({ ...design, floorColor: event.target.value })} /></label>
        </fieldset>
        {furnitureRequests && <section className="rc-planner-section" aria-labelledby="planner-detected-label">
          <h3 id="planner-detected-label">写真から検出した家具</h3>
          <p className="rc-planner-note" id="planner-detected-help">正しく検出された家具にチェックを入れると、次の部屋に残します。</p>
          {detectedItems.length === 0
            ? <p className="rc-planner-note">検出された家具はありません。</p>
            : <ul className="rc-planner-detected-list">
              {detectedItems.map(item => {
                const action = furnitureRequests.operations.find(operation => operation.objectId === item.id)?.action ?? 'keep';
                return <li key={item.id}>
                  <label className="rc-planner-check">
                    <input type="checkbox" checked={action === 'keep'} aria-describedby="planner-detected-help" onChange={event => furnitureRequests.onOperationChange(item.id, event.target.checked ? 'keep' : 'remove')} />
                    <span>{item.name}{action === 'replace' && <small>入れ替える家具</small>}</span>
                  </label>
                </li>;
              })}
            </ul>}
        </section>}
        {furnitureRequests && <details className="rc-planner-fold">
          <summary>AIに提案してほしい家具{furnitureRequests.additions.length > 0 && `（${furnitureRequests.additions.length}点）`}</summary>
          <p className="rc-planner-note">次のコーディネートで提案する家具を、最大6点指定できます。</p>
          <FurnitureAdditionRows values={furnitureRequests.additions} onChange={furnitureRequests.onAdditionsChange} emptyFocusTarget={additionButton}/>
          <button ref={additionButton} type="button" className="rc-secondary" disabled={furnitureRequests.additions.length >= 6} onClick={() => furnitureRequests.onAdditionsChange([...furnitureRequests.additions, { category: 'sofa', uiId: crypto.randomUUID() }])}>家具を追加</button>
        </details>}
      </div>
    </div>
    <div className="rc-planner-footer">
      <button type="button" className="rc-primary" disabled={!dirty} onClick={onSave}>変更を保存</button>
      {(design.kind !== 'analysis' || design.items.some(item => !item.existing)) && <div><button type="button" className="rc-secondary" onClick={onProducts}>アイテムを見る</button><button type="button" className="rc-secondary" onClick={() => downloadShoppingCsv(design.items, design.title)}>購入リストCSV</button></div>}
    </div>
  </aside>;
}
