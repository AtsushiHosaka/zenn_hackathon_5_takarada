import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useRepositories } from '../../core/repositories';
import { loadConnection } from '../../core/connection';
import type { RoomDesign, RoomItem, RoomShape, Style } from '../../domain/room';
import AccountMenu from './AccountMenu';
import ReferenceSvg from './ReferenceSvg';
import RoomScene from './RoomScene';
import RecommendationPanel from './RecommendationPanel';
import RoomGenerating from './RoomGenerating';
import PlannerPanel, { type PlannerView } from './PlannerPanel';
import { roomPlanKeys as sharedRoomPlanKeys, scopedRoomPlanKeys, useRoomPlanScope, saveRoomPlan, useRoomPlans } from './plans';
import ErrorText from '../shared/ErrorText';
import { DomainError } from '../../domain/error';
import './room-studio.css';

const initialPrompt='紫色の推し活ルームにしたい。ベッドとデスクはそのまま使いたいです。';
const samplePrompt=`${initialPrompt}アクスタを飾れる場所もほしい！`;
const money=(value:number)=>`¥${value.toLocaleString('ja-JP')}`;
const presets=[{label:'紫色の推し活ルーム',style:'oshi',prompt:initialPrompt},{label:'ボタニカル',style:'botanical',prompt:'ボタニカルにしたい。ベッドとデスクはそのまま使いたいです。'},{label:'韓国風の白×ベージュ',style:'natural',prompt:'白とベージュを合わせた韓国風のお部屋にしたい。'},{label:'在宅ワークしやすく',style:'natural',prompt:'在宅ワークしやすく、落ち着いた部屋にしたい。'}] as const;
const roomShapes: {value:RoomShape;label:string}[]=[{value:'square',label:'正方形に近い'},{value:'standard',label:'やや縦長'},{value:'long',label:'細長い'}];
const shapeLabel=(shape:RoomShape)=>roomShapes.find(item=>item.value===shape)?.label??shape;
function PhotoImage({file}:{file:File}) {
  const image=useRef<HTMLImageElement>(null);
  useEffect(()=>{const url=URL.createObjectURL(file);if(image.current)image.current.src=url;return()=>URL.revokeObjectURL(url);},[file]);
  return <img ref={image} alt={file.name}/>;
}
function Intro({analysis,coordination}:{analysis:boolean;coordination:boolean}) {return <div className="rc-assistant"><span className="rc-assistant-icon"><ReferenceSvg page={3} index={2}/></span><div className="rc-assistant-body"><span className="rc-assistant-name">へやいろ</span>{analysis?<><p>まず、お部屋の広さと形を教えてください。</p><p>{coordination?'解析後、活かす家具を選びます。希望と予算に合わせた商品を3Dで確認できます。':'ベッド・デスク・本棚を置いた部屋のモックを3Dで確認できます。'}</p><div className="rc-tips"><span>いま試せること</span><ul className="rc-bullets"><li>畳数と形に合わせた部屋の表示</li><li>家具をドラッグして配置を調整</li><li>視点の切り替えとブラウザへの保存</li></ul></div></>:<><p>こんにちは。今のお部屋の写真と、どんな部屋にしたいかを教えてください。</p><p>今ある家具は活かしたまま、レイアウトと買い足すアイテムを3Dで提案します。</p><div className="rc-tips"><span>きれいに3D化するコツ</span><ul className="rc-bullets"><li>部屋の四隅から1枚ずつ、計3〜4枚</li><li>床と壁の境目が写るように</li><li>照明をつけた明るい状態で</li></ul></div></>}</div></div>;}
function EmptyScene({analysis}:{analysis:boolean}) {return <section className="rc-stage is-empty" aria-label="3Dプレビュー"><span className="rc-stage-tag"><ReferenceSvg page={3} index={11}/>3Dプレビュー</span><div className="rc-empty-art"><ReferenceSvg page={3} index={12}/></div><div className="rc-empty-copy"><p>{analysis?'広さと形を選ぶと、ここに部屋が立ち上がります':'写真を送ると、ここに部屋が立ち上がります'}</p><p>ドラッグで回転、ホイールで拡大して確認できます</p></div><ol className="rc-process">{(analysis?['広さと形を選択','部屋のモックを作成','3Dで配置を調整']:['部屋を3D化','家具を認識','アイテムを選定','部屋に配置して合成']).map((label,index)=><li key={label}><span>{index+1}</span>{label}</li>)}</ol></section>;}
function sampleDesign(base:RoomDesign,id:string):RoomDesign {
  const style:Style=id==='sample-botanical'?'botanical':id==='sample-natural'?'natural':'oshi';
  return {...base,id,style,title:style==='botanical'?'ボタニカルなワンルーム':style==='natural'?'白×木目のナチュラル':'紫の推し活ルーム',items:base.items};
}
export default function RoomStudioPage() {
  const {id='new'}=useParams();
  const isNew=id==='new';
  const {rooms,tokenStore}=useRepositories();
  const scope=useRoomPlanScope();
  const roomPlanKeys={...sharedRoomPlanKeys,...scopedRoomPlanKeys(scope)};
  const client=useQueryClient();
  const plans=useRoomPlans();
  const location=useLocation();
  const navigate=useNavigate();
  const inputState=location.state as {prompt?:string;photos?:File[];editing?:boolean;view?:PlannerView;selectedId?:string|null;dimensions?:boolean}|null;
  const cached=client.getQueryData<RoomDesign>(roomPlanKeys.detail(id));
  const validRoom=!!cached||isNew||['sample-oshi','sample-botanical','sample-natural','sample-game'].includes(id)||plans.some(plan=>plan.id===id);
  const designQuery=useQuery({queryKey:roomPlanKeys.detail(id),queryFn:()=>plans.find(plan=>plan.id===id)??sampleDesign(rooms.demo(id==='sample-botanical'?'botanical':id==='sample-natural'?'natural':'oshi'),id),initialData:()=>validRoom?(cached??plans.find(plan=>plan.id===id)??sampleDesign(rooms.demo(id==='sample-botanical'?'botanical':id==='sample-natural'?'natural':'oshi'),id)):undefined,enabled:validRoom,staleTime:Infinity});
  const design=designQuery.data??rooms.demo();
  const capability=useQuery({queryKey:roomPlanKeys.capabilities,queryFn:()=>rooms.capabilities(),staleTime:Infinity});
  const analysisMode=capability.data?.input==='dimensions';
  const acceptsPhotos=capability.data?.photos===true;
  const analyzed=design.kind==='analysis';
  const canCoordinate=capability.data?.coordination??false;
  const [tatami,setTatami]=useState(design.analysisInput?.tatami??6);
  const [shape,setShape]=useState<RoomShape>(design.analysisInput?.shape??'standard');
  const analysisPrompt=`${tatami}畳・${shapeLabel(shape)}の部屋を3Dで確認したい。`;
  const [prompt,setPrompt]=useState(inputState?.prompt??design.prompt??(isNew?initialPrompt:samplePrompt));
  const [budget,setBudget]=useState(design.budget??30000);
  const existingFurniture=(design.before?.items??design.items).filter(item=>item.existing).map(item=>design.items.find(current=>current.id===item.id)??design.editedItems?.find(edited=>edited.id===item.id)??item);
  const [keptObjectIds,setKeptObjectIds]=useState<string[]>(()=>design.keptObjectIds?.length?design.keptObjectIds:existingFurniture.map(item=>item.id));
  const selectsFurniture=analysisMode&&canCoordinate&&!isNew&&design.source==='api'&&!!design.backendRoomId;
  const noFurnitureSelected=selectsFurniture&&existingFurniture.length>0&&keptObjectIds.length===0;
  const [message,setMessage]=useState('');
  const [style,setStyle]=useState<Style>(isNew?'oshi':design.style);
  const [preset,setPreset]=useState(0);
  const [photos,setPhotos]=useState<File[]>(()=>inputState?.photos?.filter(file=>file instanceof File)??[]);
  const [samplePhotos,setSamplePhotos]=useState<number[]>(()=>loadConnection()==='dummy'?[0,1,2]:[]);
  const [photoError,setPhotoError]=useState('');
  const [notice,setNotice]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(inputState?.selectedId??design.items.find(item=>item.id==='3')?.id??design.items.find(item=>!item.existing)?.id??null);
  const [panel,setPanel]=useState(true);
  const [editing,setEditing]=useState(inputState?.editing??analyzed);
  const [view,setView]=useState<PlannerView>(inputState?.view??'perspective');
  const [dimensions,setDimensions]=useState(inputState?.dimensions??false);
  const [history,setHistory]=useState<{past:RoomDesign[];future:RoomDesign[]}>({past:[],future:[]});
  const [savedFingerprint,setSavedFingerprint]=useState(()=>JSON.stringify(design));
  const dirty=JSON.stringify(design)!==savedFingerprint;
  const [before,setBefore]=useState(false);
  const [filter,setFilter]=useState('all');
  const [rename,setRename]=useState(false);
  const [title,setTitle]=useState(design.title);
  const upload=useRef<HTMLInputElement>(null);
  const abort=useRef<AbortController|null>(null);
  const renameDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  useEffect(()=>{if(rename)renameDialog.current?.showModal();else renameDialog.current?.close();},[rename]);
  const generation=useMutation({
    mutationFn:async({request,budget,targetStyle,analyzeOnly}:{request:string;budget:number;targetStyle?:Style;analyzeOnly?:boolean})=>{
      const controller=new AbortController();abort.current=controller;
      const token=tokenStore.load();
      const input={photos,prompt:request,style:targetStyle??style,budget,tatami,shape,roomId:!isNew&&design.source==='api'?design.backendRoomId:undefined,keptObjectIds:selectsFurniture?keptObjectIds:undefined,editedItems:selectsFurniture?[...existingFurniture,...(design.editedItems??[]).filter(item=>!item.existing&&design.items.some(current=>current.id===item.id))]:undefined};
      const result=await (analyzeOnly?rooms.analyze(input,controller.signal):rooms.generate(input,controller.signal));
      if(controller.signal.aborted||tokenStore.load()!==token) throw new DomainError("ログイン状態が変わりました。もう一度お試しください。");
      return result;
    },
    onSuccess:(result,variables)=>{
      const editedItems=(design.editedItems??[]).filter(item=>item.existing||result.items.some(current=>current.id===item.id));
      const saved={...result,...(!variables.analyzeOnly&&editedItems.length?{editedItems}:{}),...(result.kind==='analysis'&&canCoordinate?{prompt:variables.request,budget:variables.budget}:{}),id:result.source==='api'?result.id:isNew||id.startsWith('sample-')?`room-${crypto.randomUUID()}`:id};
      try {saveRoomPlan(client,saved,scope);}catch{client.setQueryData(roomPlanKeys.detail(saved.id),saved);setNotice('ブラウザに保存できませんでした。保存容量を確認してください。');}
      setSavedFingerprint(JSON.stringify(saved));setHistory({past:[],future:[]});
      navigate(`/rooms/${saved.id}`,{state:{prompt:saved.prompt??(result.kind==='analysis'?analysisPrompt:variables.request),photos:result.analysisInput?[]:photos,editing:result.kind==='analysis'&&!canCoordinate}});
    },
  });
  const additions=design.items.filter(item=>!item.existing);
  const total=additions.reduce((sum,item)=>sum+(item.price??0),0);
  const referenceStory=design.source==='demo'&&design.style==='oshi'&&additions.length===8&&additions.find(item=>item.id==='3')?.color==='#bba5ee';
  const referenceBase=rooms.demo('oshi');
  const referenceLayout=referenceStory&&!design.wallColor&&design.items.every(item=>{const original=referenceBase.items.find(base=>base.id===item.id);return original&&JSON.stringify(item.position)===JSON.stringify(original.position)&&JSON.stringify(item.size)===JSON.stringify(original.size)&&item.color===original.color&&!(item.rotation??0);});
  const pending=generation.isPending;
  function addPhotos(files:File[]) {
    const errors:string[]=[];
    const valid=files.filter(file=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type)){errors.push('JPG・PNG・WebPの画像を選んでください。');return false;}if(file.size>10*1024*1024){errors.push('写真は1枚10MB以下にしてください。');return false;}return !photos.some(previous=>previous.name===file.name&&previous.size===file.size&&previous.lastModified===file.lastModified);});
    if(photos.length+valid.length>4)errors.push('写真は最大4枚です。');
    if(valid.length)setSamplePhotos([]);
    setPhotos(previous=>[...previous,...valid].slice(0,4));setPhotoError([...new Set(errors)].join(' '));
  }
  function start(event:FormEvent) {
    event.preventDefault();setNotice('');
    if(!capability.data?.generation){setPhotoError(capability.data?.message??'生成APIへの接続を確認してください。');return;}
    if(analysisMode){
      if(!Number.isFinite(tatami)||tatami<3||tatami>30){setPhotoError('部屋の広さは3〜30畳で入力してください。');return;}
      if(canCoordinate&&!prompt.trim()){setPhotoError('どんな部屋にしたいかを入力してください。');return;}
      if(canCoordinate&&(!Number.isSafeInteger(budget)||budget<=0)){setPhotoError('予算は1円以上の整数で入力してください。');return;}
      setPhotoError('');generation.mutate({request:canCoordinate?prompt.trim():analysisPrompt,budget,analyzeOnly:canCoordinate});return;
    }
    if(photos.length<3&&samplePhotos.length<3){setPhotoError('部屋の写真を3〜4枚追加してください。');return;}
    if(!prompt.trim()){setPhotoError('どんな部屋にしたいかを入力してください。');return;}
    setPhotoError('');generation.mutate({request:prompt.trim(),budget:100000});
  }
  function followup(event:FormEvent) {
    event.preventDefault();if(!message.trim())return;
    if(!canCoordinate){setNotice('希望に合わせたコーディネートと商品提案は、APIの提供待ちです。');return;}
    if(!capability.data?.generation){setNotice('追加のコーディネートは、生成APIの提供待ちです。');return;}
    if(noFurnitureSelected){setPhotoError('活かす家具を1点以上選んでください。');return;}
    if(loadConnection()==='dummy'&&!/予算.*[2２]|落ち着いた紫|グリーン/.test(message)){setNotice('サンプルでは、用意したスタイルと予算の変更を試せます。自由な指示での生成はAPIの提供待ちです。');return;}
    generation.mutate({request:`${prompt}\n${message}`,targetStyle:/グリーン/.test(message)?'botanical':style,budget:/予算.*[2２]|2万円|２万円/.test(message)?20000:budget});
  }
  function coordinate(event:FormEvent) {
    event.preventDefault();
    if(noFurnitureSelected){setPhotoError('活かす家具を1点以上選んでください。');return;}
    if(!prompt.trim()){setPhotoError('どんな部屋にしたいかを入力してください。');return;}
    if(!Number.isSafeInteger(budget)||budget<=0){setPhotoError('予算は1円以上の整数で入力してください。');return;}
    setPhotoError('');generation.mutate({request:prompt.trim(),budget});
  }
  function changeTitle(event:FormEvent) {event.preventDefault();const value=title.trim();if(!value)return;try{const next={...design,title:value};saveRoomPlan(client,next,scope);setSavedFingerprint(JSON.stringify(next));setRename(false);}catch{setNotice('ルーム名を保存できませんでした。');}}
  function editDesign(next:RoomDesign) {
    if(JSON.stringify(next)===JSON.stringify(design))return;
    setBefore(false);
    setHistory(previous=>({past:[...previous.past,design].slice(-50),future:[]}));
    const edits=new Map((design.editedItems??[]).map(item=>[item.id,item]));
    next.items.forEach(item=>{const previous=design.items.find(value=>value.id===item.id);if(previous&&JSON.stringify([item.position,item.rotation??0,item.size,item.color])!==JSON.stringify([previous.position,previous.rotation??0,previous.size,previous.color]))edits.set(item.id,item);});
    client.setQueryData(roomPlanKeys.detail(id),{...next,editedItems:[...edits.values()]});
  }
  function moveItem(itemId:string, position:RoomItem['position']) {
    if(!editing||before||(design.modelUrl&&design.modelKind!=='shell'))return;
    const item=design.items.find(item=>item.id===itemId);if(!item)return;
    editDesign({...design,items:design.items.map(value=>value.id===itemId?{...value,position:[position[0],item.position[1],position[2]]}:value)});
  }
  function undo() {
    const previous=history.past.at(-1);if(!previous)return;
    client.setQueryData(roomPlanKeys.detail(id),previous);
    setHistory({past:history.past.slice(0,-1),future:[design,...history.future]});
  }
  function redo() {
    const next=history.future[0];if(!next)return;
    client.setQueryData(roomPlanKeys.detail(id),next);
    setHistory({past:[...history.past,design].slice(-50),future:history.future.slice(1)});
  }
  function saveEdits() {
    const saved={...design,id:id.startsWith('sample-')?`room-${crypto.randomUUID()}`:design.id};
    try {
      saveRoomPlan(client,saved,scope);setSavedFingerprint(JSON.stringify(saved));
      if(saved.id!==id)navigate(`/rooms/${saved.id}`,{state:{prompt,photos,editing:true,view,selectedId,dimensions}});
      else setNotice('家具の配置と色を、このブラウザに保存しました。');
    }catch{setNotice('変更を保存できませんでした。ブラウザの保存容量を確認してください。');}
  }
  if(!validRoom)return <main className="room-list-main"><h1>ルームが見つかりません</h1><p>このブラウザに保存されているルームを一覧から選んでください。</p><Link to="/rooms">マイルームへ戻る</Link></main>;
  return <div className="rc-studio">
    <header className="rc-studio-header"><Link className="rc-back" to="/rooms"><ReferenceSvg page={3} index={0}/>マイルーム</Link><span className="rc-header-divider"/><div className={`rc-title${isNew?' is-new':''}`}><h1>{isNew?'新しいルーム':design.title}</h1>{!isNew&&<button type="button" aria-label="ルーム名を変更" onClick={()=>{setTitle(design.title);setRename(true);}}><ReferenceSvg page={5} index={1}/></button>}</div><AccountMenu onEditLayout={!isNew&&id!=='sample-game'?()=>{setEditing(true);setPanel(true);setBefore(false);}:undefined}/></header>
    <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event=>{addPhotos(Array.from(event.target.files??[]));event.target.value='';}}/>
    <div className="rc-workspace">
      {pending||id==='sample-game'?<RoomGenerating prompt={analysisMode&&!canCoordinate?analysisPrompt:isNew?prompt:message||prompt} photos={acceptsPhotos?photos:[]} sample={loadConnection()==='dummy'} dimensions={analysisMode} coordination={canCoordinate&&!generation.variables?.analyzeOnly} onCancel={()=>pending?abort.current?.abort():navigate('/rooms')}/>:<>
        <section className="rc-chat" aria-label="チャット">
          {isNew?<>
            <div className="rc-messages is-new"><Intro analysis={analysisMode} coordination={canCoordinate}/></div>
            <form className="rc-new-composer" onSubmit={start} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();addPhotos(Array.from(event.dataTransfer.files));}}>
              {analysisMode?<div className="rc-analysis-settings"><label className="rc-setting" htmlFor="room-tatami">部屋の広さ<span className="rc-tatami-input"><input id="room-tatami" type="number" min={3} max={30} step="0.5" value={Number.isNaN(tatami)?'':tatami} onChange={event=>setTatami(event.target.valueAsNumber)} required/>畳</span></label><fieldset><legend>部屋の形</legend><div className="rc-shape-options">{roomShapes.map(item=><button key={item.value} type="button" aria-pressed={shape===item.value} onClick={()=>setShape(item.value)}>{item.label}</button>)}</div></fieldset><p className="rc-setting-note">{capability.data?.message}</p>{canCoordinate&&<label className="rc-setting" htmlFor="room-budget">買い足すアイテムの予算<span className="rc-tatami-input"><input id="room-budget" type="number" min={1} step={1} value={Number.isNaN(budget)?'':budget} onChange={event=>setBudget(event.target.valueAsNumber)} required/>円</span></label>}</div>:null}
              {acceptsPhotos&&<><div className="rc-photo-heading" title={samplePhotos.length?'サンプル写真です。追加すると選んだ写真に置き換わります。':''}><span>部屋の写真{analysisMode&&'（任意）'}</span><span><strong>{photos.length||samplePhotos.length}</strong> / 4枚</span></div>
              <div className="rc-photos">{photos.length?photos.map((file,index)=><div className="rc-photo" key={`${file.name}-${file.lastModified}`}><PhotoImage file={file}/><button type="button" className="rc-photo-remove" aria-label={`写真${index+1}を削除`} onClick={()=>setPhotos(old=>old.filter((_,i)=>i!==index))}><ReferenceSvg page={3} index={4}/></button></div>):samplePhotos.map(index=><div className="rc-photo" key={index} aria-label={`サンプル写真${index+1}`}><ReferenceSvg page={3} index={3+index*2}/><button type="button" className="rc-photo-remove" aria-label={`写真${index+1}を削除`} onClick={()=>setSamplePhotos(old=>old.filter(i=>i!==index))}><ReferenceSvg page={3} index={4}/></button></div>)}{(photos.length||samplePhotos.length)<4&&<button type="button" className="rc-photo-add" aria-label="写真を追加（撮影またはライブラリ）" onClick={()=>upload.current?.click()}><ReferenceSvg page={3} index={9}/>追加</button>}</div>
              </>}
              {canCoordinate&&<div className="rc-presets">{presets.map((item,index)=><button type="button" key={item.label} aria-pressed={preset===index} onClick={()=>{setPreset(index);setStyle(item.style);setPrompt(item.prompt);}}>{item.label}</button>)}</div>}
              <div className="rc-request-box">{canCoordinate&&<><label className="rc-sr-only" htmlFor="new-request">どんな部屋にしたいか</label><textarea id="new-request" rows={3} placeholder="例：紫色の推し活ルームにしたい" value={prompt} maxLength={analysisMode?500:2000} onChange={event=>setPrompt(event.target.value)}/></>}<div className="rc-request-actions"><button type="submit" className="rc-primary">{analysisMode&&canCoordinate?'部屋を解析する':canCoordinate?'コーディネートを始める':'部屋のモックを表示'}<ReferenceSvg page={3} index={10}/></button></div></div>
              {photoError&&<p className="rc-error" role="alert">{photoError}</p>}<ErrorText error={generation.error}/>
            </form>
          </>:<>
            <div className="rc-messages">
              <div className="rc-user-message">{!design.analysisInput&&<div className="rc-user-photos">{photos.length?photos.map(file=><div key={`${file.name}-${file.lastModified}`}><PhotoImage file={file}/></div>):[3,4,5,6].map(index=><div key={index}><ReferenceSvg page={5} index={index}/></div>)}</div>}<p>{design.kind==='analysis'&&design.analysisInput?`${design.analysisInput.tatami}畳・${shapeLabel(design.analysisInput.shape)}の部屋を3Dで確認したい。`:prompt}</p></div>
              <div className="rc-assistant"><span className="rc-assistant-icon"><ReferenceSvg page={5} index={7}/></span><div className="rc-assistant-body"><span className="rc-assistant-name">へやいろ</span><span className="rc-complete"><ReferenceSvg page={5} index={8}/>{analyzed?design.generatedBy==='gemini'?'AIが写真から解析した部屋です':'部屋の解析モックです':design.source==='demo'?'サンプルのコーディネートです':design.generatedBy==='gemini'?'AI (Gemini) のコーディネートです':'モックAPIのコーディネートです'}</span><p>{referenceStory?'今あるベッドとデスクはそのままに、紫をアクセントにした推し活ルームにしました。':design.description}</p>
                {referenceStory&&<ul className="rc-bullets"><li>壁の上部にLEDテープを回して、夜は紫の間接照明に</li><li>ベッドの足元に、アクスタを飾れるひな壇シェルフ</li><li>ラグ・クッション・ベッドカバーをラベンダー系で統一</li></ul>}
                <div className="rc-summary"><div className="rc-summary-heading"><span>{analyzed?'今ある家具':'コーディネート案'}</span><span>{analyzed?`${design.items.length}点`:<>{additions.length}アイテム · <span className="rc-money">{money(total)}</span></>}</span></div><div className="rc-summary-actions"><button type="button" className="rc-primary" onClick={()=>{setEditing(analyzed);setPanel(true);}}><ReferenceSvg page={5} index={9}/>{analyzed?'家具の配置を編集':'アイテム一覧'}</button><button type="button" className="rc-secondary" onClick={()=>setBefore(old=>!old)}>Before / After</button></div></div>
              </div></div>
              {canCoordinate&&!analyzed&&<div className="rc-followups">{['もう少し落ち着いた紫に','予算を2万円以内に','グリーンも足したい'].map(text=><button type="button" key={text} onClick={()=>setMessage(text)}>{text}</button>)}</div>}
              {selectsFurniture&&<fieldset className="rc-kept-furniture">
                <legend>活かす家具を選ぶ</legend>
                <p>選んだ家具を残して、買い足すアイテムを提案します。</p>
                <div className="rc-kept-options">{existingFurniture.map(item=><label key={item.id}>
                  <input type="checkbox" checked={keptObjectIds.includes(item.id)} onChange={event=>{setKeptObjectIds(previous=>event.target.checked?[...previous,item.id]:previous.filter(value=>value!==item.id));setPhotoError('');}}/>
                  <span>{item.name}</span>
                </label>)}</div>
                <p className="rc-setting-note">現在は、家具をすべて外した提案には対応していません。1点以上選んでください。</p>
                {!analyzed&&<p className="rc-setting-note">追加の提案にも、編集した家具の配置・角度・色を引き継ぎます。同じ商品を採用する場合は、調整した配置を保ちます。</p>}
              </fieldset>}
              {canCoordinate&&analyzed&&<form className="rc-coordinate-form" onSubmit={coordinate}>
                <label className="rc-setting" htmlFor="coordinate-request">どんな部屋にしたいか<textarea id="coordinate-request" rows={3} value={prompt} maxLength={500} onChange={event=>setPrompt(event.target.value)} required/></label>
                <label className="rc-setting" htmlFor="coordinate-budget">買い足すアイテムの予算<span className="rc-tatami-input"><input id="coordinate-budget" type="number" min={1} step={1} value={Number.isNaN(budget)?'':budget} onChange={event=>setBudget(event.target.valueAsNumber)} required/>円</span></label>
                <button type="submit" className="rc-primary" disabled={noFurnitureSelected}>この家具でコーディネート</button>
                <p className="rc-setting-note">家具の配置・角度・色を調整してからコーディネートできます。編集した配置に合わせて、買い足すアイテムを提案します。</p>
                {photoError&&<p className="rc-error" role="alert">{photoError}</p>}
              </form>}
              <ErrorText error={generation.error}/>
            </div>
            {canCoordinate&&analyzed?<div className="rc-followup-composer rc-analysis-note">家具を選び、希望と予算を確認してコーディネートしてください。</div>:canCoordinate?<form className="rc-followup-composer" onSubmit={followup}><div className="rc-followup-input">{!analysisMode&&<button type="button" aria-label="写真を追加" onClick={()=>upload.current?.click()}><ReferenceSvg page={5} index={10}/></button>}<label className="rc-sr-only" htmlFor="res-msg">メッセージ</label><textarea id="res-msg" rows={1} placeholder="変えたいところを伝えてください" value={message} maxLength={analysisMode?500:2000} onChange={event=>setMessage(event.target.value)}/><button type="submit" aria-label="送信" disabled={noFurnitureSelected}><ReferenceSvg page={5} index={11}/></button></div>{photoError&&<p className="rc-error" role="alert">{photoError}</p>}</form>:<div className="rc-followup-composer rc-analysis-note">{loadConnection()==='dummy'?'商品付きの提案は、右上メニューでAPI接続に切り替えて試せます。':'希望文からの提案は、コーディネートAPIの提供後に利用できます。'}</div>}
          </>}
        </section>
        {isNew?<EmptyScene analysis={analysisMode}/>:<RoomScene key={design.id} design={design} panel={panel} before={before} filter={filter} selectedId={selectedId} referenceLayout={referenceLayout} editing={editing} view={view} dimensions={dimensions} onSelect={value=>{setSelectedId(value);setPanel(true);setFilter('all');const item=design.items.find(item=>item.id===value);if(item?.existing&&!editing)setNotice(`${item.name}は、今ある家具をそのまま使います。`);}} onBefore={setBefore} onMoveItem={moveItem} onOpenPanel={()=>setPanel(true)}>{panel&&(editing?<PlannerPanel design={design} selectedId={selectedId} onSelect={setSelectedId} onChange={editDesign} onUndo={undo} onRedo={redo} canUndo={history.past.length>0} canRedo={history.future.length>0} dirty={dirty} onSave={saveEdits} onClose={()=>{setEditing(false);setPanel(false);}} onProducts={()=>setEditing(false)} view={view} onView={setView} dimensions={dimensions} onDimensions={setDimensions}/>:<RecommendationPanel items={additions} selectedId={selectedId} filter={filter} onSelect={setSelectedId} onFilter={setFilter} onClose={()=>setPanel(false)}/>)}</RoomScene>}
      </>}
    </div>
    {notice&&<div className="rc-notice" role="status">{notice}<button type="button" aria-label="通知を閉じる" onClick={()=>setNotice('')}>×</button></div>}
    <dialog ref={renameDialog} className="rc-dialog" onCancel={()=>setRename(false)}><form onSubmit={changeTitle}><div className="rc-dialog-heading"><h2>ルーム名を変更</h2><button type="button" aria-label="閉じる" onClick={()=>setRename(false)}>×</button></div><label className="rc-setting">ルーム名<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={80} required autoFocus/></label><p/><button className="rc-primary" type="submit">保存</button></form></dialog>
  </div>;
}
