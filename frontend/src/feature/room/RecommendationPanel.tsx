import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RoomItem } from '../../domain/room';
import ReferenceSvg from './ReferenceSvg';
import { PlacedModelCredits } from './ModelCredits';
import { categoryOf } from './itemCategory';
import { motionScrollIntoView, motionStaggerStyle, prefersReducedMotion, useReducedMotion } from '../../core/motion';
const money=(value:number)=>`¥${value.toLocaleString('ja-JP')}`;
const illustrations:Record<string,number>={led:21,shelf:23,display:23,rug:25,artwork:27,wall_decor:27,cushion:29,lamp:31,light:31,plant:33,cover:35,bed_cover:35};
const labels=[['all','すべて'],['light','照明'],['storage','収納'],['fabric','ファブリック'],['goods','雑貨']];
function productLink(value?:string) {try { const url=new URL(value??'');return ['https:','http:'].includes(url.protocol)?url.href:null; }catch{return null;} }
const dimensionLabel = (value:number|null) => value === null ? '不明' : `${Math.round(value*1000)/10}cm`;
function ProductImage({item}:{item:RoomItem}) {
  const [failed,setFailed]=useState(false);
  const image=productLink(item.imageUrl);
  if(image&&!failed)return <img src={image} alt={item.name} loading="lazy" onError={()=>setFailed(true)}/>;
  return illustrations[item.category.toLowerCase()]!==undefined?<ReferenceSvg page={5} index={illustrations[item.category.toLowerCase()]}/>:<ReferenceSvg page={3} index={2}/>;
}
function ProductDetails({item,originalItems}:{item:RoomItem;originalItems?:RoomItem[]}) {
  const metadata=item.productMetadata;
  const replaced=originalItems?.find(original=>original.id===item.replacesObjectId);
  return <>
    {item.replacesObjectId&&<span className="rc-item-shop">{replaced?.name??item.replacesObjectId}の入れ替え</span>}
    {metadata?.size&&<span className="rc-item-shop">商品寸法: 幅{dimensionLabel(metadata.size.w)} × 高さ{dimensionLabel(metadata.size.h)} × 奥行き{dimensionLabel(metadata.size.d)}</span>}
  </>;
}
export default function RecommendationPanel({items,originalItems,searchEntryPoints,selectedId,filter,onSelect,onFilter,onClose,onEditLayout}:{items:RoomItem[];originalItems?:RoomItem[];searchEntryPoints?:string[];selectedId:string|null;filter:string;onSelect:(id:string)=>void;onFilter:(filter:string)=>void;onClose:()=>void;onEditLayout?:()=>void}) {
  const listRef = useRef<HTMLUListElement>(null);
  const reduced=useReducedMotion();
  const positions = useRef(new Map<string,number>());
  const previousSelection = useRef({selectedId,filter});
  const visible = items.filter(item=>filter==='all'||categoryOf(item)===filter);
  const visibleIds = visible.map(item=>item.id).join('|');
  useLayoutEffect(()=>{
    const list=listRef.current;
    if(!list)return;
    const movements:Animation[]=[];
    const next=new Map<string,number>(),top=list.getBoundingClientRect().top;
    list.querySelectorAll<HTMLElement>('[data-product-id]').forEach(row=>{
      const id=row.dataset.productId!,position=row.getBoundingClientRect().top-top+list.scrollTop;
      const previous=positions.current.get(id);
      if(previous!==undefined&&Math.abs(previous-position)>1&&!prefersReducedMotion()){
        const delta=Math.max(-48,Math.min(48,previous-position));
        movements.push(row.animate([{translate:`0 ${delta}px`,opacity:.8},{translate:'0 0',opacity:1}],{duration:180,easing:'cubic-bezier(.2,.7,.3,1)'}));
      }
      next.set(id,position);
    });
    positions.current=next;
    return ()=>movements.forEach(animation=>animation.cancel());
  },[filter,visibleIds,reduced]);
  useEffect(() => {
    const previous=previousSelection.current;
    previousSelection.current={selectedId,filter};
    if(previous.selectedId===selectedId&&previous.filter===filter)return;
    const list=listRef.current, selected=list?.querySelector<HTMLElement>('.is-selected');
    if (!list || !selected || list.closest('[inert]') || selected.matches(':hover') && !selected.matches(':focus-visible')) return;
    const row=selected.getBoundingClientRect(), viewport=list.getBoundingClientRect();
    if (row.top < viewport.top || row.bottom > viewport.bottom) motionScrollIntoView(selected);
  }, [selectedId, filter]);
  const total=items.reduce((sum,item)=>sum+(item.price??0),0);
  const searchSuggestions=[...new Set([...(searchEntryPoints??[]),...items.flatMap(item=>item.productMetadata?.searchEntryPointHtml?[item.productMetadata.searchEntryPointHtml]:[])])];
  return <aside className="rc-panel" aria-label="おすすめアイテム">
    <div className="rc-panel-header"><div className="rc-panel-title"><h2>おすすめアイテム<span>{items.length}</span></h2><button type="button" className="motion-control" aria-label="パネルを閉じる" onClick={onClose}><ReferenceSvg page={5} index={20}/></button></div><div className="rc-panel-total"><span>商品価格の合計</span><strong>{money(total)}</strong><span>{items.length}点</span></div>
      {onEditLayout&&<button type="button" className="rc-secondary" onClick={onEditLayout}>家具を追加・配置を編集</button>}
      <div className="rc-categories" role="group" aria-label="カテゴリで絞り込み">{labels.map(([key,label])=><button type="button" className="motion-control" key={key} aria-pressed={filter===key} onClick={()=>onFilter(key)}>{label} {key==='all'?items.length:items.filter(item=>categoryOf(item)===key).length}</button>)}</div>
    </div>
    <ul ref={listRef} className="rc-items">{visible.map((item,index)=>{const url=productLink(item.productUrl);const body=<>
      <span className="rc-item-art"><ProductImage key={item.imageUrl??item.id} item={item}/><span className="rc-item-number">{item.marker??items.indexOf(item)+1}</span></span>
      <span className="rc-item-copy"><span className="rc-item-name clamp2">{item.name}</span><span className="rc-item-shop">{labels.find(([key])=>key===categoryOf(item))?.[1]} · {item.shop??'購入先未登録'}</span><span className="rc-money">{item.price===undefined?'価格未登録':money(item.price)}</span><ProductDetails item={item} originalItems={originalItems}/></span><span className="rc-item-external">{url&&<ReferenceSvg page={5} index={22}/>}</span>
    </>;return <li key={item.id} data-product-id={item.id} style={motionStaggerStyle(index)}>{url?<a href={url} target="_blank" rel="noopener noreferrer" className={`rc-item-link motion-control${selectedId===item.id?' is-selected':''}`} onMouseEnter={()=>onSelect(item.id)} onFocus={()=>onSelect(item.id)} onClick={()=>onSelect(item.id)}>{body}</a>:<button type="button" className={`rc-item-link motion-control${selectedId===item.id?' is-selected':''}`} onFocus={()=>onSelect(item.id)} onClick={()=>onSelect(item.id)} aria-label={`${index+1}. ${item.name}（購入リンク未登録）`}>{body}</button>}<PlacedModelCredits modelUrl={item.modelUrl}/></li>;})}</ul>
    {/* google.com refuses to render inside a frame, so suggestion links open in a new tab. */}
    {!!searchSuggestions.length&&<div className="rc-panel-note" style={{maxHeight:220,overflowY:"auto"}}><span>Googleの検索候補</span>{searchSuggestions.map((html,index)=><iframe key={html} title={`Googleの検索候補 ${index+1}`} srcDoc={`<base target="_blank">${html}`} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" style={{display:'block',width:'100%',height:160,border:0,background:'#fff'}}/>)}</div>}
  </aside>;
}
