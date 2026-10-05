import { useEffect, useRef } from 'react';
import type { RoomItem } from '../../domain/room';
import ReferenceSvg from './ReferenceSvg';
import { categoryOf } from './itemCategory';
const money=(value:number)=>`¥${value.toLocaleString('ja-JP')}`;
const illustrations:Record<string,number>={led:21,shelf:23,display:23,rug:25,artwork:27,wall_decor:27,cushion:29,lamp:31,light:31,plant:33,cover:35,bed_cover:35};
const labels=[['all','すべて'],['light','照明'],['storage','収納'],['fabric','ファブリック'],['goods','雑貨']];
function productLink(value?:string) {try { const url=new URL(value??'');return ['https:','http:'].includes(url.protocol)?url.href:null; }catch{return null;} }
export default function RecommendationPanel({items,selectedId,filter,onSelect,onFilter,onClose}:{items:RoomItem[];selectedId:string|null;filter:string;onSelect:(id:string)=>void;onFilter:(filter:string)=>void;onClose:()=>void}) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId, filter]);
  const total=items.reduce((sum,item)=>sum+(item.price??0),0);
  return <aside className="rc-panel" aria-label="おすすめアイテム">
    <div className="rc-panel-header"><div className="rc-panel-title"><h2>おすすめアイテム<span>{items.length}</span></h2><button type="button" aria-label="パネルを閉じる" onClick={onClose}><ReferenceSvg page={5} index={20}/></button></div><div className="rc-panel-total"><span>合計</span><strong>{money(total)}</strong><span>{items.length}点すべて購入した場合</span></div>
      <div className="rc-categories" role="group" aria-label="カテゴリで絞り込み">{labels.map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>onFilter(key)}>{label} {key==='all'?items.length:items.filter(item=>categoryOf(item)===key).length}</button>)}</div>
    </div>
    <ul ref={listRef} className="rc-items">{items.filter(item=>filter==='all'||categoryOf(item)===filter).map((item,index)=>{const url=productLink(item.productUrl);const body=<>
      <span className="rc-item-art">{productLink(item.imageUrl)?<img src={productLink(item.imageUrl)!} alt={item.name} loading="lazy"/>:illustrations[item.category.toLowerCase()]!==undefined?<ReferenceSvg page={5} index={illustrations[item.category.toLowerCase()]}/>:<ReferenceSvg page={3} index={2}/>}<span className="rc-item-number">{item.marker??items.indexOf(item)+1}</span></span>
      <span className="rc-item-copy"><span className="rc-item-name clamp2">{item.name}</span><span className="rc-item-shop">{labels.find(([key])=>key===categoryOf(item))?.[1]} · {item.shop??'購入先未登録'}</span><span className="rc-money">{item.price===undefined?'価格未登録':money(item.price)}</span></span><span className="rc-item-external">{url&&<ReferenceSvg page={5} index={22}/>}</span>
    </>;return <li key={item.id}>{url?<a href={url} target="_blank" rel="noopener noreferrer" className={`rc-item-link${selectedId===item.id?' is-selected':''}`} onMouseEnter={()=>onSelect(item.id)} onFocus={()=>onSelect(item.id)} onClick={()=>onSelect(item.id)}>{body}</a>:<button type="button" className={`rc-item-link${selectedId===item.id?' is-selected':''}`} onClick={()=>onSelect(item.id)} aria-label={`${index+1}. ${item.name}（購入リンク未登録）`}>{body}</button>}</li>;})}</ul>
    <p className="rc-panel-note">商品情報と価格は参考値です。3Dの形・色・寸法は近似です。価格・在庫・仕様はリンク先でご確認ください。</p>
  </aside>;
}
