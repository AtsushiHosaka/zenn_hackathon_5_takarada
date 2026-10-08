import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { useRepositories } from '../../core/repositories';
import { useSession } from '../../core/session';
import { loadConnection } from '../../core/connection';
import { isManualFurniture, type FurnitureAddition, type FurnitureOperation, type RoomDesign, type RoomItem, type RoomShape, type Style } from '../../domain/room';
import type { RoomGenerationPhase } from '../../domain/roomRepository';
import AccountMenu from './AccountMenu';
import ReferenceSvg from './ReferenceSvg';
import RoomScene from './RoomScene';
import RecommendationPanel from './RecommendationPanel';
import RoomGenerating from './RoomGenerating';
import RoomPalettePicker from './RoomPalettePicker';
import { defaultRoomPaletteId } from '../../domain/roomPalette';
import PlannerPanel, { type PlannerView } from './PlannerPanel';
import { furniturePositionInRoom, getFurniturePlacementBounds, snapFurnitureEditPosition } from './roomBounds';
import { roomDescription } from './roomDescription';
import { roomPlanKeys as sharedRoomPlanKeys, scopedRoomPlanKeys, useRoomPlanScope, saveRoomPlan, useRoomPlan, isApiRoomAlias } from './plans';
import ErrorText from '../shared/ErrorText';
import { DomainError } from '../../domain/error';
import CharacterThemePicker from './CharacterThemePicker';
import { roomPhotoLimits, roomPhotoRequirements, roomPhotoValidationError } from '../../domain/roomPhoto';
import './room-studio.css';

const initialPrompt='紫色の推し活ルームにしたい。ベッドとデスクはそのまま使いたいです。';
const samplePrompt=`${initialPrompt}アクスタを飾れる場所もほしい！`;
const money=(value:number)=>`¥${value.toLocaleString('ja-JP')}`;
const presets=[{label:'紫色の推し活ルーム',style:'oshi',prompt:initialPrompt},{label:'ボタニカル',style:'botanical',prompt:'ボタニカルにしたい。ベッドとデスクはそのまま使いたいです。'},{label:'韓国風の白×ベージュ',style:'natural',prompt:'白とベージュを合わせた韓国風のお部屋にしたい。'},{label:'在宅ワークしやすく',style:'natural',prompt:'在宅ワークしやすく、落ち着いた部屋にしたい。'}] as const;
const roomShapes: {value:RoomShape;label:string}[]=[{value:'square',label:'正方形に近い'},{value:'standard',label:'やや縦長'},{value:'long',label:'細長い'}];
const shapeLabel=(shape:RoomShape)=>roomShapes.find(item=>item.value===shape)?.label??shape;
function existingItems(design:RoomDesign):RoomItem[] {
  const edits=design.editedItems??[];
  const source=(design.before?.items??design.items).filter(item=>item.existing&&(!isManualFurniture(item)||design.items.some(current=>current.id===item.id||current.replacesObjectId===item.id)||edits.some(current=>current.id===item.id)));
  const furniture=new Map(source.map(item=>[item.id,design.items.find(current=>current.id===item.id&&current.existing)??edits.find(current=>current.id===item.id&&current.existing)??item]));
  [...design.items,...edits].filter(item=>isManualFurniture(item)).forEach(item=>{if(!furniture.has(item.id))furniture.set(item.id,item);});
  return [...furniture.values()];
}
function PhotoImage({file}:{file:File}) {
  const image=useRef<HTMLImageElement>(null);
  useEffect(()=>{const url=URL.createObjectURL(file);if(image.current)image.current.src=url;return()=>URL.revokeObjectURL(url);},[file]);
  return <img ref={image} alt={file.name}/>;
}
type InputStep = 'tatami' | 'shape' | 'photos' | 'request';
const stepLabels: Record<InputStep,string> = {tatami:'広さ',shape:'形',photos:'写真',request:'希望'};
function Intro({step,analysis}:{step:InputStep|undefined;analysis:boolean}) {
  return <div className="rc-assistant"><span className="rc-assistant-icon"><ReferenceSvg page={3} index={2}/></span><div className="rc-assistant-body" aria-live="polite"><span className="rc-assistant-name">へやいろ</span>
    {step==='tatami'?<p>お部屋は何畳くらいですか？</p>:step==='shape'?<p>お部屋の形を教えてください。</p>:step==='photos'?<p>{analysis?'お部屋の写真はありますか？':'お部屋の写真を追加してください。'}</p>:step==='request'?<p>どんなお部屋にしたいですか？</p>:<p>入力できる項目を確認しています。</p>}
  </div></div>;
}
type FollowupMode = 'current' | 'new';
function FollowupModePicker({value,onChange,canModify}:{value:FollowupMode;onChange:(value:FollowupMode)=>void;canModify:boolean}) {
  return <fieldset className="rc-followup-mode"><legend>プロンプトの反映先</legend>
    <label><input type="radio" name="followup-mode" value="current" checked={value==='current'} disabled={!canModify} onChange={()=>onChange('current')}/>現在の部屋を修正</label>
    <label><input type="radio" name="followup-mode" value="new" checked={value==='new'} onChange={()=>onChange('new')}/>新しい部屋を生成</label>
    <p>{value==='current'?'現在の部屋の家具と編集内容を引き継ぎます。':'現在の部屋を残し、同じ広さ・形で別の部屋を作ります。'}</p>
  </fieldset>;
}
function EmptyScene() {return <section className="rc-stage is-empty" aria-label="3Dプレビュー"><span className="rc-stage-tag"><ReferenceSvg page={3} index={11}/>3Dプレビュー</span><div className="rc-empty-art"><ReferenceSvg page={3} index={12}/></div></section>;}
function sampleDesign(base:RoomDesign,id:string):RoomDesign {
  const style:Style=id==='sample-botanical'?'botanical':id==='sample-natural'?'natural':'oshi';
  return {...base,id,style,title:style==='botanical'?'ボタニカルなワンルーム':style==='natural'?'白×木目のナチュラル':'紫の推し活ルーム',items:base.items};
}
export default function RoomStudioPage() {
  const {id='new'}=useParams();
  const sample=id.startsWith('sample-');
  const {rooms}=useRepositories();
  const local=id==='new'||sample;
  const saved=useRoomPlan(id,!local,local?()=>sampleDesign(rooms.demo(id==='sample-botanical'?'botanical':id==='sample-natural'?'natural':'oshi'),id):undefined);
  if(!saved.data||(isApiRoomAlias(id)&&(saved.isFetching||saved.isError))) return <main className="rc-missing-room">
    <Link className="rc-back" to="/rooms" aria-label="ルーム一覧に戻る"><ReferenceSvg page={3} index={0}/></Link>
    {saved.isPending||saved.isFetching?<p role="status">読み込み中…</p>:<><ErrorText error={saved.error}/><button className="rc-secondary" onClick={()=>void saved.refetch()}>再試行</button></>}
  </main>;
  if(saved.data && saved.data.id!==id) return <Navigate to={`/rooms/${encodeURIComponent(saved.data.id)}`} replace/>;
  return <LoadedRoomStudioPage key={id} initialDesign={saved.data}/>;
}
function LoadedRoomStudioPage({initialDesign}:{initialDesign:RoomDesign}) {
  const {id='new'}=useParams();
  const isNew=id==='new';
  const {rooms,tokenStore}=useRepositories();
  const session=useSession();
  const scope=useRoomPlanScope();
  const roomPlanKeys={...sharedRoomPlanKeys,...scopedRoomPlanKeys(scope)};
  const client=useQueryClient();
  const location=useLocation();
  const navigate=useNavigate();
  const inputState=location.state as {prompt?:string;photos?:File[];editing?:boolean;view?:PlannerView;selectedId?:string|null;dimensions?:boolean;notice?:string}|null;
  const design=initialDesign;
  const capability=useQuery({queryKey:roomPlanKeys.capabilities,queryFn:()=>rooms.capabilities(),staleTime:Infinity});
  const analysisMode=capability.data?.input==='dimensions';
  const acceptsPhotos=capability.data?.photos===true;
  const analyzed=design.kind==='analysis';
  const canCoordinate=capability.data?.coordination??false;
  const [tatami,setTatami]=useState(design.analysisInput?.tatami??6);
  const [shape,setShape]=useState<RoomShape>(design.analysisInput?.shape??'standard');
  const analysisPrompt=`${tatami}畳・${shapeLabel(shape)}の部屋を3Dで確認したい。`;
  const [prompt,setPrompt]=useState(inputState?.prompt??(isNew?'':design.prompt??(analyzed?'':samplePrompt)));
  const [budget,setBudget]=useState(design.budget??30000);
  const existingFurniture=existingItems(design);
  const [furnitureOperations,setFurnitureOperations]=useState<FurnitureOperation[]>(()=>design.furnitureOperations??existingFurniture.map(item=>({objectId:item.id,action:'keep'})));
  const [furnitureAdditions,setFurnitureAdditions]=useState<FurnitureAddition[]>(()=>design.furnitureAdditions??[]);
  const selectsFurniture=analysisMode&&canCoordinate&&!isNew&&design.source==='api'&&!!design.backendRoomId;
  const [message,setMessage]=useState('');
  const [roomPaletteId,setRoomPaletteId]=useState(design.roomPaletteId??defaultRoomPaletteId);
  const [characterThemeId,setCharacterThemeId]=useState<string|undefined>(design.characterThemeId);
  const canModify=Boolean(design.source==='api'&&design.backendRoomId);
  const [followupMode,setFollowupMode]=useState<FollowupMode>(canModify?'current':'new');
  const [generationPhase,setGenerationPhase]=useState<RoomGenerationPhase>('analyzing');
  const [style,setStyle]=useState<Style>(isNew?'oshi':design.style);
  const [preset,setPreset]=useState<number|null>(null);
  const [stepIndex,setStepIndex]=useState(0);
  const inputSteps: InputStep[]=capability.data?(analysisMode?['tatami','shape',...(acceptsPhotos?['photos' as const]:[])]:[...(acceptsPhotos?['photos' as const]:[]),...(canCoordinate?['request' as const]:[])]):[];
  const inputStep=inputSteps[stepIndex];
  const lastInputStep=stepIndex===inputSteps.length-1;
  const [photos,setPhotos]=useState<File[]>(()=>inputState?.photos?.filter(file=>file instanceof File)??[]);
  const [samplePhotos,setSamplePhotos]=useState<number[]>(()=>loadConnection()==='dummy'?[0,1,2]:[]);
  const [photoError,setPhotoError]=useState('');
  const [notice,setNotice]=useState(inputState?.notice??'');
  const [selectedId,setSelectedId]=useState<string|null>(inputState?.selectedId??design.items.find(item=>item.id==='3')?.id??design.items.find(item=>!item.existing)?.id??null);
  const [panel,setPanel]=useState(!analyzed||!!inputState?.selectedId);
  const [editing,setEditing]=useState(inputState?.editing??analyzed);
  const [view,setView]=useState<PlannerView>(inputState?.view??'perspective');
  const [placementItem,setPlacementItem]=useState<RoomItem|null>(null);
  const [dimensions,setDimensions]=useState(inputState?.dimensions??false);
  const [history,setHistory]=useState<{past:RoomDesign[];future:RoomDesign[]}>({past:[],future:[]});
  const [savedFingerprint,setSavedFingerprint]=useState(()=>JSON.stringify(design));
  const dirty=JSON.stringify(design)!==savedFingerprint;
  const [before,setBefore]=useState(false);
  const placementDisabled=before||Boolean(design.modelUrl&&design.modelKind!=='shell');
  const [filter,setFilter]=useState('all');
  const [rename,setRename]=useState(false);
  const [title,setTitle]=useState(design.title);
  const upload=useRef<HTMLInputElement>(null);
  const abort=useRef<AbortController|null>(null);
  const renameDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  useEffect(()=>{if(rename)renameDialog.current?.showModal();else renameDialog.current?.close();},[rename]);
  function requireOwner():boolean {
    if(session.status==='authenticated')return true;
    navigate('/login',{state:{from:location.pathname}});
    return false;
  }
  const generation=useMutation({
    mutationFn:async({request,budget,targetStyle,analyzeOnly,followup=false,createNew=false}:{request:string;budget:number;targetStyle?:Style;analyzeOnly?:boolean;followup?:boolean;createNew?:boolean})=>{
      const controller=new AbortController();abort.current=controller;
      setGenerationPhase(photos.length&&isNew&&!createNew?'uploading':'analyzing');
      const token=tokenStore.load();
      // 追加の指示のときは前回のコーデを渡し、指示に関係ない商品を残してもらう
      const baseCoordinationId=!createNew&&(followup||design.editedItems?.some(item=>item.ecProductId&&!item.existing))&&design.source==='api'&&design.kind==='coordination'?design.id.replace(/^api-coordination-/,''):undefined;
      const roomId=!createNew&&!isNew&&!id.startsWith('sample-')
        ? design.backendRoomId??(loadConnection()==='dummy'&&design.id.startsWith('dummy-room-')?design.id:undefined)
        : undefined;
      const useCurrentFurniture=selectsFurniture&&!createNew;
      const input={characterThemeId,roomPaletteId,onProgress:(phase:RoomGenerationPhase)=>{if(!controller.signal.aborted)setGenerationPhase(phase);},baseCoordinationId,photos:createNew?[]:photos,prompt:request,style:targetStyle??style,budget,tatami,shape,roomId,keptObjectIds:useCurrentFurniture?existingFurniture.filter(item=>(furnitureOperations.find(operation=>operation.objectId===item.id)?.action??'keep')==='keep').map(item=>item.id):undefined,furnitureOperations:useCurrentFurniture?existingFurniture.map(item=>({objectId:item.id,action:furnitureOperations.find(operation=>operation.objectId===item.id)?.action??'keep'})):undefined,furnitureAdditions:useCurrentFurniture?furnitureAdditions:undefined,editedItems:useCurrentFurniture?[...new Map([...existingFurniture,...(design.editedItems??[]).filter(item=>!item.existing&&design.items.some(current=>current.id===item.id))].map(item=>{const original=existingFurniture.find(value=>value.id===item.id);return [item.id,original&&isManualFurniture(original)&&!item.existing?{...original,position:item.position,size:item.size,rotation:item.rotation,color:item.color,replacementEcProductId:Number(item.ecProductId)}:item] as const;})).values()]:undefined};
      const result=await (analyzeOnly?rooms.analyze(input,controller.signal):rooms.generate(input,controller.signal));
      if(controller.signal.aborted||tokenStore.load()!==token) throw new DomainError("ログイン状態が変わりました。もう一度お試しください。");
      return result;
    },
    onSuccess:(result,variables)=>{
      const editedItems=(variables.createNew?[]:design.editedItems??[]).filter(item=>item.existing||result.items.some(current=>current.id===item.id));
      const saved={...result,characterThemeId:result.characterThemeId??characterThemeId,roomPaletteId:result.roomPaletteId??roomPaletteId,...(!variables.analyzeOnly&&editedItems.length?{editedItems}:{}),...(result.kind==='analysis'&&canCoordinate?{prompt:variables.request.trim()||undefined,budget:variables.budget}:{}),id:result.id};
      let storageNotice: string|undefined;
      try {saveRoomPlan(client,saved,scope);}catch{client.setQueryData(roomPlanKeys.detail(saved.id),saved);if(!rooms.persistenceWarning?.()){storageNotice='ブラウザに保存できませんでした。保存容量を確認してください。';setNotice(storageNotice);}}
      setSavedFingerprint(JSON.stringify(saved));setHistory({past:[],future:[]});
      setFurnitureOperations(saved.furnitureOperations??(saved.before?.items??saved.items).filter(item=>item.existing).map(item=>({objectId:item.id,action:'keep'})));
      setFurnitureAdditions(saved.furnitureAdditions??[]);
      navigate(`/rooms/${saved.id}`,{state:{prompt:result.kind==='analysis'&&canCoordinate?variables.request:saved.prompt??(result.kind==='analysis'?analysisPrompt:variables.request),photos:result.analysisInput?[]:photos,editing:result.kind==='analysis',notice:storageNotice}});
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
    const valid=files.filter(file=>{const error=roomPhotoValidationError(file);if(error){errors.push(error);return false;}return !photos.some(previous=>previous.name===file.name&&previous.size===file.size&&previous.lastModified===file.lastModified);});
    if(photos.length+valid.length>roomPhotoLimits.maxCount)errors.push('写真は最大4枚です。');
    if(valid.length)setSamplePhotos([]);
    setPhotos(previous=>[...previous,...valid].slice(0,roomPhotoLimits.maxCount));setPhotoError([...new Set(errors)].join(' '));
  }
  function changeStep(index:number) {
    setStepIndex(index);setPhotoError('');generation.reset();
  }
  function start(event:FormEvent) {
    event.preventDefault();setNotice('');
    if(!capability.data||!inputStep)return;
    if(inputStep==='tatami'&&(!Number.isFinite(tatami)||tatami<3||tatami>30)){setPhotoError('部屋の広さは3〜30畳で入力してください。');return;}
    if(inputStep==='photos'&&!analysisMode&&photos.length<3&&samplePhotos.length<3){setPhotoError('部屋の写真を3〜4枚追加してください。');return;}
    if(!lastInputStep){changeStep(stepIndex+1);return;}
    if(!capability.data.generation){setPhotoError(capability.data.message);return;}
    if(analysisMode){
      if(!Number.isFinite(tatami)||tatami<3||tatami>30){changeStep(0);setPhotoError('部屋の広さは3〜30畳で入力してください。');return;}
      setPhotoError('');generation.mutate({request:canCoordinate?prompt.trim():analysisPrompt,budget,analyzeOnly:canCoordinate});return;
    }
    if(!prompt.trim()){setPhotoError('どんな部屋にしたいかを入力してください。');return;}
    setPhotoError('');generation.mutate({request:prompt.trim(),budget:100000});
  }
  function followup(event:FormEvent) {
    event.preventDefault();if(!message.trim()||!requireOwner())return;
    if(!canCoordinate){setNotice('コーディネートは利用できません。');return;}
    if(!capability.data?.generation){setNotice('コーディネートは利用できません。');return;}
    if(loadConnection()==='dummy'&&!/予算.*[2２]|落ち着いた紫|グリーン/.test(message)){setNotice('この変更はサンプルでは利用できません。');return;}
    generation.mutate({request:message.trim(),targetStyle:/グリーン/.test(message)?'botanical':style,budget:/予算.*[2２]|2万円|２万円/.test(message)?20000:budget,followup:true,createNew:followupMode==='new'});
  }
  function coordinate(event:FormEvent) {
    event.preventDefault();
    if(!requireOwner())return;
    if(!prompt.trim()){setPhotoError('どんな部屋にしたいかを入力してください。');return;}
    if(!Number.isSafeInteger(budget)||budget<=0){setPhotoError('予算は1円以上の整数で入力してください。');return;}
    setPhotoError('');generation.mutate({request:prompt.trim(),budget,createNew:followupMode==='new'});
  }
  function changeTitle(event:FormEvent) {event.preventDefault();if(!requireOwner())return;const value=title.trim();if(!value)return;try{const next={...design,title:value};saveRoomPlan(client,next,scope);setSavedFingerprint(JSON.stringify(next));setRename(false);}catch{setNotice('ルーム名を保存できませんでした。');}}
  function editDesign(next:RoomDesign) {
    if(JSON.stringify(next)===JSON.stringify(design))return;
    // Preserve the rendered floor before any original furniture can move.
    if(!design.room)next={...next,inferredRoomBounds:getFurniturePlacementBounds(design)};
    setBefore(false);
    setHistory(previous=>({past:[...previous.past,design].slice(-50),future:[]}));
    // Explicit deletion updates next.editedItems; replacement keeps the original.
    const edits=new Map((next.editedItems??[]).map(item=>[item.id,item]));
    next.items.forEach(item=>{const previous=design.items.find(value=>value.id===item.id);if(!previous||JSON.stringify(item)!==JSON.stringify(previous))edits.set(item.id,item);});
    const editedItems=[...edits.values()];
    const operations=existingItems({...next,editedItems}).map(item=>({objectId:item.id,action:(next.furnitureOperations??furnitureOperations).find(operation=>operation.objectId===item.id)?.action??'keep' as const}));
    client.setQueryData(roomPlanKeys.detail(id),{...next,editedItems,...((next.furnitureOperations||design.furnitureOperations)?{furnitureOperations:operations,keptObjectIds:operations.filter(operation=>operation.action==='keep').map(operation=>operation.objectId)}:{})});
  }
  function moveItem(itemId:string, position:RoomItem['position']) {
    if(!editing||before||(design.modelUrl&&design.modelKind!=='shell'))return;
    const item=design.items.find(item=>item.id===itemId);if(!item)return;
    const boundedPosition=snapFurnitureEditPosition(item,position,[0,2],design);if(!boundedPosition)return;
    editDesign({...design,items:design.items.map(value=>value.id===itemId?{...value,position:boundedPosition}:value)});
  }
  function addItem(candidate:RoomItem,position?:RoomItem['position']) {
    setPlacementItem(null);
    if(!editing||placementDisabled)return;
    if(candidate.artwork&&design.items.reduce((total,item)=>total+(item.artwork?.dataUrl.length??0),0)+candidate.artwork.dataUrl.length>1024*1024){setNotice('この部屋の推しグッズ画像は合計1MBまでです。グッズを削除してから追加してください。');return;}
    const boundedPosition=furniturePositionInRoom(candidate,position??candidate.position,design);
    if(!boundedPosition){setNotice('この寸法の家具は部屋に収まりません。寸法を小さくしてください。');return;}
    const item={...candidate,id:`manual-${crypto.randomUUID()}`,position:boundedPosition};
    editDesign({...design,items:[...design.items,item]});
    setSelectedId(item.id);setBefore(false);
  }
  function startPlacement(item:RoomItem|null) {
    if(item&&(!editing||placementDisabled))return;
    if(item&&view==='front')setView('top');
    setPlacementItem(item);
  }
  function removeItem(itemId:string) {
    if(!editing||placementDisabled||!itemId.startsWith('manual-'))return;
    editDesign({...design,items:design.items.filter(item=>item.id!==itemId),editedItems:(design.editedItems??[]).filter(item=>item.id!==itemId)});
    if(selectedId===itemId)setSelectedId(null);
    setPlacementItem(null);
  }
  function undo() {
    const previous=history.past.at(-1);if(!previous)return;
    client.setQueryData(roomPlanKeys.detail(id),previous);
    setFurnitureOperations(previous.furnitureOperations??existingItems(previous).map(item=>({objectId:item.id,action:'keep'})));
    setHistory({past:history.past.slice(0,-1),future:[design,...history.future]});
  }
  function redo() {
    const next=history.future[0];if(!next)return;
    client.setQueryData(roomPlanKeys.detail(id),next);
    setFurnitureOperations(next.furnitureOperations??existingItems(next).map(item=>({objectId:item.id,action:'keep'})));
    setHistory({past:[...history.past,design].slice(-50),future:history.future.slice(1)});
  }
  function saveEdits() {
    if(!requireOwner())return;
    const saved={...design,id:id.startsWith('sample-')?`room-${crypto.randomUUID()}`:design.id};
    try {
      saveRoomPlan(client,saved,scope);setSavedFingerprint(JSON.stringify(saved));
      if(saved.id!==id)navigate(`/rooms/${saved.id}`,{state:{prompt,photos,editing:true,view,selectedId,dimensions}});
      else setNotice('保存しました。');
    }catch{setNotice('変更を保存できませんでした。ブラウザの保存容量を確認してください。');}
  }
  return <div className="rc-studio">
    <header className="rc-studio-header"><Link className="rc-back" to="/rooms" aria-label="ルーム一覧に戻る" title="ルーム一覧"><ReferenceSvg page={3} index={0}/></Link><span className="rc-header-divider"/><div className={`rc-title${isNew?' is-new':''}`}><h1>{isNew?'新しいルーム':design.title}</h1>{!isNew&&<button type="button" aria-label="ルーム名を変更" onClick={()=>{setTitle(design.title);setRename(true);}}><ReferenceSvg page={5} index={1}/></button>}</div><AccountMenu onEditLayout={!isNew&&id!=='sample-game'?()=>{setEditing(true);setPanel(true);setBefore(false);}:undefined}/></header>
    <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden aria-describedby="room-photo-requirements" onChange={event=>{addPhotos(Array.from(event.target.files??[]));event.target.value='';}}/>
    <div className="rc-workspace">
      {pending||id==='sample-game'?<RoomGenerating phase={generationPhase} prompt={analysisMode&&(!canCoordinate||generation.variables?.analyzeOnly)?analysisPrompt:isNew?prompt:message||prompt} photos={acceptsPhotos?photos:[]} sample={loadConnection()==='dummy'} dimensions={analysisMode} coordination={canCoordinate&&!generation.variables?.analyzeOnly} onCancel={()=>pending?abort.current?.abort():navigate('/rooms')}/>:<>
        <section className="rc-chat" aria-label="チャット">
          {isNew?<>
            <div className="rc-messages is-new">{stepIndex>0&&<div className="rc-input-summary">{inputSteps.slice(0,stepIndex).map(step=><p key={step}>{step==='tatami'?`${tatami}畳`:step==='shape'?shapeLabel(shape):step==='photos'?`写真 ${photos.length||samplePhotos.length}枚`:prompt}</p>)}</div>}<Intro step={inputStep} analysis={analysisMode}/></div>
            <form className="rc-new-composer" onSubmit={start} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(inputStep==='photos')addPhotos(Array.from(event.dataTransfer.files));}}>
              {inputSteps.length>0&&<ol className="rc-input-progress" aria-label="部屋の入力手順">{inputSteps.map((step,index)=><li key={step} aria-current={index===stepIndex?'step':undefined} className={index<stepIndex?'is-complete':''}><span>{index+1}</span>{stepLabels[step]}</li>)}</ol>}
              {inputStep==='tatami'&&<div className="rc-analysis-settings"><label className="rc-setting" htmlFor="room-tatami">部屋の広さ<span className="rc-tatami-input"><input id="room-tatami" type="number" min={3} max={30} step="0.5" value={Number.isNaN(tatami)?'':tatami} onChange={event=>setTatami(event.target.valueAsNumber)} required/>畳</span></label></div>}
              {inputStep==='shape'&&<div className="rc-analysis-settings"><fieldset><legend>部屋の形</legend><div className="rc-shape-options">{roomShapes.map(item=><button key={item.value} type="button" aria-pressed={shape===item.value} onClick={()=>setShape(item.value)}>{item.label}</button>)}</div></fieldset></div>}
              {inputStep==='photos'&&<><div className="rc-photo-heading"><span>部屋の写真{analysisMode&&'（任意）'}</span><span><strong>{photos.length||samplePhotos.length}</strong> / {roomPhotoLimits.maxCount}枚</span></div>
              <p id="room-photo-requirements" className="rc-photo-requirements">{roomPhotoRequirements}</p>
              <div className="rc-photos">{photos.length?photos.map((file,index)=><div className="rc-photo" key={`${file.name}-${file.lastModified}`}><PhotoImage file={file}/><button type="button" className="rc-photo-remove" aria-label={`写真${index+1}を削除`} onClick={()=>setPhotos(old=>old.filter((_,i)=>i!==index))}><ReferenceSvg page={3} index={4}/></button></div>):samplePhotos.map(index=><div className="rc-photo" key={index} aria-label={`サンプル写真${index+1}`}><ReferenceSvg page={3} index={3+index*2}/><button type="button" className="rc-photo-remove" aria-label={`写真${index+1}を削除`} onClick={()=>setSamplePhotos(old=>old.filter(i=>i!==index))}><ReferenceSvg page={3} index={4}/></button></div>)}{(photos.length||samplePhotos.length)<roomPhotoLimits.maxCount&&<button type="button" className="rc-photo-add" aria-label="写真を追加（撮影またはライブラリ）" aria-describedby="room-photo-requirements" onClick={()=>upload.current?.click()}><ReferenceSvg page={3} index={9}/>追加</button>}</div>
              </>}
              {inputStep==='request'&&<><div className="rc-presets">{presets.map((item,index)=><button type="button" key={item.label} aria-pressed={preset===index} onClick={()=>{setPreset(index);setStyle(item.style);setPrompt(item.prompt);}}>{item.label}</button>)}</div><div className="rc-request-box"><label className="rc-sr-only" htmlFor="new-request">どんな部屋にしたいか</label><textarea id="new-request" rows={3} placeholder="例：紫色の推し活ルームにしたい" value={prompt} maxLength={2000} onChange={event=>setPrompt(event.target.value)} required/></div></>}
              {lastInputStep&&(canCoordinate||loadConnection()==='dummy')&&<CharacterThemePicker value={characterThemeId} onChange={value=>{setCharacterThemeId(value);if(value){setStyle('oshi');if(!prompt.trim())setPrompt('推しグッズを飾れる部屋にしたい。');}}}/>}
              {lastInputStep&&(canCoordinate||loadConnection()==='dummy')&&<RoomPalettePicker value={roomPaletteId} onChange={setRoomPaletteId}/>}
              <div className="rc-input-actions">{stepIndex>0&&<button type="button" className="rc-secondary" onClick={()=>changeStep(stepIndex-1)}>戻る</button>}<button type="submit" className="rc-primary" disabled={!inputStep}>{!lastInputStep?'次へ':analysisMode?canCoordinate?'部屋を解析する':'部屋を作成する':'コーディネートを始める'}<ReferenceSvg page={3} index={10}/></button></div>

              <ErrorText error={capability.error}/>
              {photoError&&<p className="rc-error" role="alert">{photoError}</p>}<ErrorText error={generation.error}/>
            </form>
          </>:<>
            <div className="rc-messages">
              <div className="rc-user-message">{!design.analysisInput&&<div className="rc-user-photos">{photos.length?photos.map(file=><div key={`${file.name}-${file.lastModified}`}><PhotoImage file={file}/></div>):[3,4,5,6].map(index=><div key={index}><ReferenceSvg page={5} index={index}/></div>)}</div>}<p>{design.kind==='analysis'&&design.analysisInput?`${design.analysisInput.tatami}畳・${shapeLabel(design.analysisInput.shape)}の部屋を3Dで確認したい。`:prompt}</p></div>
              <div className="rc-assistant"><span className="rc-assistant-icon"><ReferenceSvg page={5} index={7}/></span><div className="rc-assistant-body"><span className="rc-assistant-name">へやいろ</span><span className="rc-complete"><ReferenceSvg page={5} index={8}/>{design.source==='demo'?'サンプル':analyzed?'解析完了':'コーディネート完了'}</span><p>{referenceStory?'今あるベッドとデスクはそのままに、紫をアクセントにした推し活ルームにしました。':roomDescription(design.description)}</p>
                {referenceStory&&<ul className="rc-bullets"><li>壁の上部にLEDテープを回して、夜は紫の間接照明に</li><li>ベッドの足元に、アクスタを飾れるひな壇シェルフ</li><li>ラグ・クッション・ベッドカバーをラベンダー系で統一</li></ul>}
                {!analyzed&&<div className="rc-summary"><div className="rc-summary-heading"><span>コーディネート案</span><span>{additions.length}アイテム · <span className="rc-money">{money(total)}</span></span></div><div className="rc-summary-actions"><button type="button" className="rc-primary" onClick={()=>{setEditing(false);setPanel(true);}}><ReferenceSvg page={5} index={9}/>アイテム一覧</button><button type="button" className="rc-secondary" onClick={()=>setBefore(old=>!old)}>Before / After</button></div></div>}
              </div></div>
              {canCoordinate&&!analyzed&&<CharacterThemePicker value={characterThemeId} onChange={setCharacterThemeId}/>}
              {canCoordinate&&!analyzed&&<RoomPalettePicker value={roomPaletteId} onChange={setRoomPaletteId}/>}
              {canCoordinate&&!analyzed&&<div className="rc-followups">{['もう少し落ち着いた紫に','予算を2万円以内に','グリーンも足したい'].map(text=><button type="button" key={text} onClick={()=>setMessage(text)}>{text}</button>)}</div>}
              {canCoordinate&&analyzed&&<form className="rc-coordinate-form" onSubmit={coordinate}>
                <FollowupModePicker value={followupMode} onChange={setFollowupMode} canModify={canModify}/>
                <div className="rc-presets">{presets.map((item,index)=><button type="button" key={item.label} aria-pressed={preset===index} onClick={()=>{setPreset(index);setStyle(item.style);setPrompt(item.prompt);}}>{item.label}</button>)}</div>
                <CharacterThemePicker value={characterThemeId} onChange={value=>{setCharacterThemeId(value);if(value){setStyle('oshi');if(!prompt.trim())setPrompt('推しグッズを飾れる部屋にしたい。');}}}/>
                <label className="rc-setting" htmlFor="coordinate-request">どんな部屋にしたいか<textarea id="coordinate-request" rows={3} value={prompt} maxLength={500} onChange={event=>setPrompt(event.target.value)} required/></label>
                <RoomPalettePicker value={roomPaletteId} onChange={setRoomPaletteId}/>
                <label className="rc-setting" htmlFor="coordinate-budget">入れ替え・追加商品の予算（送料別）<span className="rc-tatami-input"><input id="coordinate-budget" type="number" min={1} step={1} value={Number.isNaN(budget)?'':budget} onChange={event=>setBudget(event.target.valueAsNumber)} required/>円</span></label>
                <button type="submit" className="rc-primary" >この家具でコーディネート</button>

                {photoError&&<p className="rc-error" role="alert">{photoError}</p>}
              </form>}
              <ErrorText error={generation.error}/>
            </div>
            {canCoordinate&&analyzed?null:canCoordinate?<form className="rc-followup-composer" onSubmit={followup}><FollowupModePicker value={followupMode} onChange={setFollowupMode} canModify={canModify}/><div className="rc-followup-input">{!analysisMode&&<button type="button" aria-label="写真を追加" onClick={()=>upload.current?.click()}><ReferenceSvg page={5} index={10}/></button>}<label className="rc-sr-only" htmlFor="res-msg">メッセージ</label><textarea id="res-msg" rows={1} placeholder="変えたいところを伝えてください" value={message} maxLength={analysisMode?500:2000} onChange={event=>setMessage(event.target.value)}/><button type="submit" aria-label="送信" ><ReferenceSvg page={5} index={11}/></button></div>{photoError&&<p className="rc-error" role="alert">{photoError}</p>}</form>:<div className="rc-followup-composer rc-analysis-note">コーディネートは利用できません。</div>}
          </>}
        </section>
        {isNew?<EmptyScene/>:<RoomScene key={design.id} design={design} panel={panel} before={before} filter={filter} selectedId={selectedId} referenceLayout={referenceLayout} editing={editing} view={view} dimensions={dimensions} onSelect={value=>{setSelectedId(value);setPanel(true);setFilter('all');const item=design.items.find(item=>item.id===value);if(analyzed||item){setEditing(true);setBefore(false);}}} onBefore={value=>{setPlacementItem(null);setBefore(value);}} onMoveItem={moveItem} placementItem={placementItem} onPlaceItem={position=>{if(placementItem)addItem(placementItem,position);}} onOpenPanel={()=>{setPanel(true);if(analyzed)setEditing(true);}}>{panel&&(editing?<PlannerPanel onAddItem={addItem} onDragItem={startPlacement} onRemoveItem={removeItem} placementDisabled={placementDisabled} placementHint={before?'Afterに切り替えると家具を追加できます。':undefined} design={design} selectedId={selectedId} onSelect={setSelectedId} furnitureRequests={selectsFurniture?{existingItems:existingFurniture,operations:furnitureOperations,additions:furnitureAdditions,onOperationChange:(objectId,action)=>setFurnitureOperations(previous=>[...previous.filter(operation=>operation.objectId!==objectId),{objectId,action}]),onAdditionsChange:setFurnitureAdditions}:undefined} onChange={editDesign} onUndo={undo} onRedo={redo} canUndo={history.past.length>0} canRedo={history.future.length>0} dirty={dirty} onSave={saveEdits} onClose={()=>{setPlacementItem(null);setEditing(false);setPanel(false);}} onProducts={()=>{setPlacementItem(null);setEditing(false);}} view={view} onView={setView} dimensions={dimensions} onDimensions={setDimensions}/>:<RecommendationPanel onEditLayout={()=>{setEditing(true);setBefore(false);}} searchEntryPoints={design.searchEntryPoints} originalItems={design.before?.items} items={additions} selectedId={selectedId} filter={filter} onSelect={setSelectedId} onFilter={setFilter} onClose={()=>setPanel(false)}/>)}</RoomScene>}
      </>}
    </div>
    {notice&&<div className="rc-notice" role="status">{notice}<button type="button" aria-label="通知を閉じる" onClick={()=>setNotice('')}>×</button></div>}
    {rooms.persistenceWarning?.()&&<div className="rc-notice" role="alert">{rooms.persistenceWarning()}</div>}
    <dialog ref={renameDialog} className="rc-dialog" onCancel={()=>setRename(false)}><form onSubmit={changeTitle}><div className="rc-dialog-heading"><h2>ルーム名を変更</h2><button type="button" aria-label="閉じる" onClick={()=>setRename(false)}>×</button></div><label className="rc-setting">ルーム名<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={80} required autoFocus/></label><p/><button className="rc-primary" type="submit">保存</button></form></dialog>
  </div>;
}
