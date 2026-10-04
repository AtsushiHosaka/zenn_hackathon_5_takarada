import { Component, Fragment, lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import type { RoomDesign, RoomItem } from '../../domain/room';
import ReferenceSvg from './ReferenceSvg';
import { categoryOf } from './itemCategory';
const RoomViewer = lazy(() => import('./RoomViewer'));
const points = [[38.45,13.9],[24.38,40.73],[39.54,67.71],[40.62,22.44],[46.39,59.02],[73.09,40.49],[51.08,68.05],[41.34,43.17]];
const money = (value: number) => `¥${value.toLocaleString('ja-JP')}`;
class ViewerBoundary extends Component<{children:ReactNode}, {failed:boolean}> {
  state = { failed:false };
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <div className="viewer-fallback"><strong>3Dを表示できませんでした</strong><p>アイテム一覧から詳細を確認できます。</p></div> : this.props.children; }
}
type Props = {
  design: RoomDesign; panel: boolean; before: boolean; filter: string; selectedId: string|null;
  onSelect: (id:string)=>void; onBefore:(before:boolean)=>void; onOpenPanel:()=>void; children:ReactNode;
  onMoveItem: (id:string, position:RoomItem['position'])=>void;
  referenceLayout:boolean; editing:boolean; view:'perspective'|'top'|'front'; dimensions:boolean;
};
export default function RoomScene({design, panel, before, filter, selectedId, onSelect, onBefore, onOpenPanel, onMoveItem, children, referenceLayout, editing, view, dimensions}:Props) {
  const [moved,setMoved] = useState(false);
  const [command,setCommand] = useState<{sequence:number;action:'left'|'right'|'in'|'out'}>();
  const [resetKey,setResetKey] = useState(0);
  const start = useRef<{x:number;y:number}|null>(null);
  const additions=design.items.filter(item=>!item.existing);
  const pins=referenceLayout&&!moved&&!editing&&!before&&view==='perspective';
  const draggable=editing&&!before&&(!design.modelUrl||design.modelKind==='shell');
  const gestureHint=draggable
    ? view==='front'?'家具をドラッグで左右に移動 · ホイールで拡大'
      : view==='top'?'家具をドラッグで移動 · ホイールで拡大'
      : '家具をドラッグで移動 · 空いている場所で回転'
    : view==='perspective'?'ドラッグで回転 · ホイールで拡大':'ホイールで拡大 · 右ドラッグで視点を移動';
  function control(action:'left'|'right'|'in'|'out') {setMoved(true);setCommand(old=>({sequence:(old?.sequence??0)+1,action}));}
  function reset() {setResetKey(key=>key+1);setCommand(undefined);setMoved(false);}
  return <section className="rc-stage" aria-label="3Dプレビュー">
    <div className={`rc-scene-stage${panel?' has-panel':''}`}>
      <div className="rc-scene" onPointerDown={event=>{start.current={x:event.clientX,y:event.clientY};}} onPointerMove={event=>{if(start.current&&Math.hypot(event.clientX-start.current.x,event.clientY-start.current.y)>8){setMoved(true);start.current=null;}}} onPointerUp={()=>{start.current=null;}} onPointerCancel={()=>{start.current=null;}} onWheel={()=>setMoved(true)}>
        <ViewerBoundary><Suspense fallback={<div className="viewer-fallback">3Dを読み込んでいます…</div>}><RoomViewer design={design} selectedItemId={selectedId} onSelectItem={onSelect} onMoveItem={onMoveItem} editing={editing} view={view} resetKey={resetKey} before={before} command={command} dimensions={dimensions}/></Suspense></ViewerBoundary>
        {pins && additions.map(item=>{const p=points[Number(item.id)-1];if(!p)return null;return <Fragment key={item.id}><button type="button" aria-label={`${item.id}. ${item.name}`} aria-pressed={selectedId===item.id} className="rc-pin" style={{left:`${p[0]}%`,top:`${p[1]}%`,opacity:filter==='all'||categoryOf(item)===filter?1:.3}} onClick={()=>onSelect(item.id)}><span>{item.id}</span></button>{selectedId===item.id&&<span className="rc-pin-tooltip" style={{left:`${p[0]}%`,top:`${p[1]}%`,...(item.id==='6'?{transform:'translate(calc(-100% - 22px), -50%)'}:{})}}>{item.name}<span className="rc-money">{money(item.price??0)}</span></span>}</Fragment>;})}
      </div>
    </div>
    <div className="rc-segment" role="group" aria-label="表示の切り替え"><button type="button" aria-pressed={before} onClick={()=>onBefore(true)}>Before</button><button type="button" aria-pressed={!before} onClick={()=>onBefore(false)}>After</button></div>
    {!panel&&<button type="button" className="rc-open-panel" onClick={onOpenPanel}><ReferenceSvg page={5} index={14}/>おすすめアイテム<span>{additions.length}</span></button>}
    <div className="rc-scene-footer"><div className="rc-toolbar" role="toolbar" aria-label="3D表示の操作">
      <button type="button" aria-label="左に回転" onClick={()=>control('left')}><ReferenceSvg page={5} index={15}/></button><button type="button" aria-label="右に回転" onClick={()=>control('right')}><ReferenceSvg page={5} index={16}/></button><span className="rc-toolbar-divider"/><button type="button" aria-label="拡大" onClick={()=>control('in')}><ReferenceSvg page={5} index={17}/></button><button type="button" aria-label="縮小" onClick={()=>control('out')}><ReferenceSvg page={5} index={18}/></button><button type="button" aria-label="視点をリセット" onClick={reset}><ReferenceSvg page={5} index={19}/></button>
    </div><span>{gestureHint}</span></div>
    {children}
  </section>;
}
