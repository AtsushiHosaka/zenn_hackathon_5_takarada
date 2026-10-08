import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { furnitureCategories, type FurnitureAddition } from '../../domain/room';
import { motionStaggerStyle } from '../../core/motion';
import { useMotionPresence } from '../shared/useMotionPresence';

const labels = {sofa:'ソファ',bed:'ベッド',desk:'デスク',chair:'チェア',shelf:'収納棚',table:'テーブル'};
type Row = {value: FurnitureAddition; active: boolean};
type RowProps = {row:Row;index:number;currentIndex:number;onExit:(id:string|undefined)=>void;onChange:(category:string)=>void;onRemove:()=>void};
function AdditionRow({row,index,currentIndex,onExit,onChange,onRemove}:RowProps) {
  const presence=useMotionPresence(row.active);
  useEffect(()=>{if(!presence.isPresent)onExit(row.value.uiId);},[presence.isPresent,row.value.uiId,onExit]);
  return presence.isPresent?<div className="rc-planner-addition motion-presence" style={motionStaggerStyle(index)} data-addition-id={row.value.uiId} data-motion-state={presence.state} inert={!row.active} aria-hidden={!row.active||undefined}>
    <select className="motion-field" aria-label={`追加家具${currentIndex+1}の種類`} value={row.value.category} onChange={event=>onChange(event.target.value)}>
      {furnitureCategories.map(category=><option key={category} value={category}>{labels[category]}</option>)}
    </select>
    <button type="button" className="rc-secondary" aria-label={`追加家具${currentIndex+1}を削除`} onClick={onRemove}>削除</button>
  </div>:null;
}
export default function FurnitureAdditionRows({values,onChange,emptyFocusTarget}:{values:FurnitureAddition[];onChange:(values:FurnitureAddition[])=>void;emptyFocusTarget:RefObject<HTMLButtonElement|null>}) {
  const [previous,setPrevious] = useState(values);
  const [rows,setRows] = useState<Row[]>(()=>values.map(value=>({value,active:true})));
  const host = useRef<HTMLDivElement>(null);
  const focusEmpty = useRef(false);
  useLayoutEffect(() => {
    if (!focusEmpty.current) return;
    focusEmpty.current = false;
    // The removed row is now inert (or gone with reduced motion). Restore
    // focus before paint without waiting for its cosmetic exit to complete.
    if (!values.length) emptyFocusTarget.current?.focus({preventScroll:true});
  }, [values,emptyFocusTarget]);
  if (previous !== values) {
    setPrevious(values);
    const current = new Map(values.map(value=>[value.uiId,value]));
    setRows([
      ...rows.map(row=>({value:current.get(row.value.uiId)??row.value,active:current.has(row.value.uiId)})),
      ...values.filter(value=>!rows.some(row=>row.value.uiId===value.uiId)).map(value=>({value,active:true})),
    ]);
  }
  const removeExited=useCallback((id:string|undefined)=>setRows(current=>current.filter(row=>row.active||row.value.uiId!==id)),[]);
  function remove(id:string|undefined) {
    const index = values.findIndex(value=>value.uiId===id);
    const focus = values[index+1]??values[index-1];
    focusEmpty.current = !focus;
    onChange(values.filter(value=>value.uiId!==id));
    if (focus) host.current?.querySelector<HTMLSelectElement>(`[data-addition-id="${focus.uiId}"] select`)?.focus({preventScroll:true});
  }
  return <div ref={host}>{rows.map((row,index)=><AdditionRow key={row.value.uiId} row={row} index={index} currentIndex={values.findIndex(value=>value.uiId===row.value.uiId)} onExit={removeExited}
    onChange={category=>onChange(values.map(value=>value.uiId===row.value.uiId?{...value,category:furnitureCategories.find(candidate=>candidate===category)??value.category}:value))} onRemove={()=>remove(row.value.uiId)}/>)}</div>;
}
