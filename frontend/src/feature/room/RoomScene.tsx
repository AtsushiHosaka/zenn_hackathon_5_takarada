import { Component, Fragment, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RoomDesign, RoomItem } from '../../domain/room';
import ReferenceSvg from './ReferenceSvg';
import { categoryOf } from './itemCategory';
import { useMotionPresence } from '../shared/useMotionPresence';
const RoomViewer = lazy(() => import('./RoomViewer'));
const points = [[38.45,13.9],[24.38,40.73],[39.54,67.71],[40.62,22.44],[46.39,59.02],[73.09,40.49],[51.08,68.05],[41.34,43.17]];
const money = (value: number) => `¥${value.toLocaleString('ja-JP')}`;
class ViewerBoundary extends Component<{children:ReactNode;onFailure:()=>void}, {failed:boolean}> {
  state = { failed:false };
  componentDidCatch() { this.props.onFailure(); }
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <div className="viewer-fallback"><strong>3Dを表示できませんでした</strong></div> : this.props.children; }
}
function PinTooltip({item,point,active}:{item:RoomItem;point:number[];active:boolean}) {
  const presence=useMotionPresence(active);
  return presence.isPresent?<span className="rc-pin-tooltip motion-presence" data-motion-state={presence.state} aria-hidden={!active||undefined} style={{left:`${point[0]}%`,top:`${point[1]}%`,...(item.id==='6'?{transform:'translate(calc(-100% - 22px), -50%)'}:{})}}>{item.name}<span className="rc-money">{money(item.price??0)}</span></span>:null;
}
type Props = {
  design: RoomDesign; panel: boolean; before: boolean; filter: string; selectedId: string|null;
  onSelect: (id:string)=>void; onBefore:(before:boolean)=>void; onOpenPanel:()=>void; children:ReactNode;
  onMoveItem: (id:string, position:RoomItem['position'],supportObjectId?:string,supportSurface?:RoomItem['supportSurface'])=>void;
  placementItem?:RoomItem|null; onPlaceItem?:(position:RoomItem['position'],supportObjectId?:string,supportSurface?:RoomItem['supportSurface'])=>void;
  referenceLayout:boolean; editing:boolean; view:'perspective'|'top'|'front'; dimensions:boolean;
};
export default function RoomScene({design, panel, before, filter, selectedId, onSelect, onBefore, onOpenPanel, onMoveItem, placementItem, onPlaceItem, children, referenceLayout, editing, view, dimensions}:Props) {
  const [readiness,setReadiness] = useState<'loading'|'ready'|'degraded'>('loading');
  const [moved,setMoved] = useState(false);
  const [command,setCommand] = useState<{sequence:number;action:'left'|'right'|'in'|'out'}>();
  const [resetKey,setResetKey] = useState(0);
  const openButton = useRef<HTMLButtonElement>(null);
  const wasPanel = useRef(panel);
  useEffect(()=>{
    if(wasPanel.current&&!panel&&document.activeElement===document.body)openButton.current?.focus({preventScroll:true});
    wasPanel.current=panel;
  },[panel]);
  const start = useRef<{x:number;y:number}|null>(null);
  const additions=design.items.filter(item=>!item.existing);
  const pins=readiness!=='loading'&&referenceLayout&&!moved&&!editing&&!placementItem&&!before&&view==='perspective';
  function control(action:'left'|'right'|'in'|'out') {setMoved(true);setCommand(old=>({sequence:(old?.sequence??0)+1,action}));}
  function reset() {setResetKey(key=>key+1);setCommand(undefined);setMoved(false);}
  return <section className="rc-stage" aria-label="3Dプレビュー">
    <div className={`rc-scene-stage${panel?' has-panel':''}`}>
      <div className="rc-scene" onPointerDown={event=>{start.current={x:event.clientX,y:event.clientY};}} onPointerMove={event=>{if(start.current&&Math.hypot(event.clientX-start.current.x,event.clientY-start.current.y)>8){setMoved(true);start.current=null;}}} onPointerUp={()=>{start.current=null;}} onPointerCancel={()=>{start.current=null;}} onWheel={()=>setMoved(true)}>
        <div className={`rc-viewer-reveal${readiness==='ready'?' motion-fade':''}`} data-readiness={readiness} inert={readiness==='loading'} aria-hidden={readiness==='loading'||undefined}><ViewerBoundary onFailure={()=>setReadiness('degraded')}><Suspense fallback={<div className="viewer-fallback">3Dを読み込んでいます…</div>}><RoomViewer design={design} selectedItemId={selectedId} onSelectItem={onSelect} onMoveItem={onMoveItem} placementItem={placementItem} onPlaceItem={onPlaceItem} editing={editing} view={view} resetKey={resetKey} before={before} command={command} dimensions={dimensions} onReady={ready=>setReadiness(previous=>previous==='loading'?(ready?'ready':'degraded'):previous)}/></Suspense></ViewerBoundary></div>{readiness==='loading'&&<div className="viewer-fallback" role="status">3Dを読み込んでいます…</div>}{readiness==='degraded'&&<p className="rc-viewer-readiness-note" role="status">3Dの一部を読み込めませんでした。表示できる内容を確認してください。</p>}
        {pins && additions.map(item=>{const p=points[Number(item.id)-1];if(!p)return null;return <Fragment key={item.id}><button type="button" aria-label={`${item.id}. ${item.name}`} aria-pressed={selectedId===item.id} className="rc-pin motion-control" style={{left:`${p[0]}%`,top:`${p[1]}%`,opacity:filter==='all'||categoryOf(item)===filter?1:.3}} onClick={()=>onSelect(item.id)}><span>{item.id}</span></button><PinTooltip item={item} point={p} active={selectedId===item.id}/></Fragment>;})}
      </div>
    </div>
    <div className="rc-segment" role="group" aria-label="表示の切り替え"><button type="button" className="motion-control" aria-pressed={before} onClick={()=>onBefore(true)}>Before</button><button type="button" className="motion-control" aria-pressed={!before} onClick={()=>onBefore(false)}>After</button></div>
    {!panel&&<button type="button" ref={openButton} className="rc-open-panel motion-control" onClick={onOpenPanel}><ReferenceSvg page={5} index={14}/>{design.kind==='analysis'?'家具を編集':<>おすすめアイテム<span>{additions.length}</span></>}</button>}
    <div className="rc-scene-footer"><div className="rc-toolbar" role="toolbar" aria-label="3D表示の操作">
      <button type="button" className="motion-control" aria-label="左に回転" onClick={()=>control('left')}><ReferenceSvg page={5} index={15}/></button><button type="button" className="motion-control" aria-label="右に回転" onClick={()=>control('right')}><ReferenceSvg page={5} index={16}/></button><span className="rc-toolbar-divider"/><button type="button" className="motion-control" aria-label="拡大" onClick={()=>control('in')}><ReferenceSvg page={5} index={17}/></button><button type="button" className="motion-control" aria-label="縮小" onClick={()=>control('out')}><ReferenceSvg page={5} index={18}/></button><button type="button" className="motion-control" aria-label="視点をリセット" onClick={reset}><ReferenceSvg page={5} index={19}/></button>
    </div></div>
    {children}
  </section>;
}
