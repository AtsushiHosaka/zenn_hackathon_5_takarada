import type { RoomDesign, RoomItem } from '../../domain/room';
import { downloadShoppingCsv } from './exports';
import { LAYOUT_GRID_STEP, snapItemPosition, snapToLayoutGrid } from './layoutGrid';
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

export default function PlannerPanel({ design, selectedId, onSelect, onChange, onUndo, onRedo, canUndo, canRedo, dirty, onSave, onClose, onProducts, view, onView, dimensions, onDimensions }: PlannerPanelProps) {
  const selected = design.items.find(item => item.id === selectedId);
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
      <div><h2>配置を編集</h2><p>{completeModel?'家具の寸法と見え方を確認できます。':view==='front'?'正面では家具が10cmのマス目に沿って左右に動きます。':'家具をドラッグすると10cmのマス目に沿って動きます。'}</p></div>
      <button className="rc-planner-close" type="button" aria-label="編集パネルを閉じる" onClick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
      </button>
    </div>
    <div className="rc-planner-content">
      <div className="rc-planner-history">
        <button type="button" onClick={onUndo} disabled={!canUndo}><ArrowIcon />元に戻す</button>
        <button type="button" onClick={onRedo} disabled={!canRedo}><ArrowIcon redo />やり直す</button>
      </div>
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
        {selected ? <>
          <dl className="rc-planner-size">
            {([['幅', 0], ['高さ', 1], ['奥行き', 2]] as const).map(([label, index]) => <div key={label}><dt>{label}</dt><dd>{cm(selected.size[index])}<span>cm</span></dd></div>)}
          </dl>
          <p className="rc-planner-note">寸法はモデルの値です。商品サイズは購入先でご確認ください。</p>
        </> : <p className="rc-planner-note">3D上の家具をクリックしても選べます。</p>}
        {completeModel && <p className="rc-planner-warning">家具を含む完成モデルのため、個別の移動・回転・色変更には対応していません。視点の切り替えは利用できます。</p>}
      </section>
      <fieldset className="rc-planner-section" disabled={itemDisabled}>
        <legend>位置を調整</legend>
        <p className="rc-planner-note">10cmのマス目に合わせて移動します。</p>
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
        {design.room && <p className="rc-planner-note">壁を越える場合は位置を部屋の内側へ調整します。部屋に収まらない角度には回転できません。</p>}
      </fieldset>
      <fieldset className="rc-planner-section" disabled={itemDisabled}>
        <legend>家具の色</legend>
        <div className="rc-planner-swatches" role="group" aria-label="家具の色を選ぶ">
          {itemColors.map(([color, label]) => <button key={color} type="button" aria-label={`家具を${label}にする`} title={label} aria-pressed={selected?.color.toUpperCase() === color.toUpperCase()} style={{ backgroundColor: color }} onClick={() => changeItem({ color })} />)}
        </div>
        <p className="rc-planner-note">プレビューの色を変更します。商品の色は変わりません。</p>
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
      <p>変更はこのブラウザに保存されます。</p>
    </div>
  </aside>;
}
