import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { useRepositories } from '../../core/repositories';
import { useSession } from '../../core/session';
import { loadConnection } from '../../core/connection';
import { isManualFurniture, isTemplateFurniture, type FurnitureAddition, type FurnitureOperation, type RoomDesign, type RoomItem, type RoomShape, type Style } from '../../domain/room';
import type { RoomGenerationPhase } from '../../domain/roomRepository';
import AccountMenu from './AccountMenu';
import ReferenceSvg from './ReferenceSvg';
import RoomScene from './RoomScene';
import RoomPanelTransition from './RoomPanelTransition';
import { useMotionPresence } from '../shared/useMotionPresence';
import { identifyFurnitureAdditions } from './furnitureAdditionIds';
import RecommendationPanel from './RecommendationPanel';
import RoomGenerating from './RoomGenerating';
import RoomPalettePicker from './RoomPalettePicker';
import { suggestedRoomPaletteId } from '../../domain/roomPaletteSuggestions';
import PlannerPanel, { type PlannerView } from './PlannerPanel';
import { furniturePositionInRoom, getFurniturePlacementBounds, furnitureSurfaceHeight, snapFurnitureEditPosition } from './roomBounds';
import { roomDescription } from './roomDescription';
import { roomPlanKeys as sharedRoomPlanKeys, scopedRoomPlanKeys, useRoomPlanScope, saveRoomPlan, useRoomPlan, isApiRoomAlias } from './plans';
import ErrorText from '../shared/ErrorText';
import { useMotionDialog } from '../shared/useMotionDialog';
import { DomainError } from '../../domain/error';
import CharacterThemePicker from './CharacterThemePicker';
import RoomTemplateChooser from './RoomTemplateChooser';
import { roomPhotoLimits, roomPhotoRequirements, roomPhotoValidationError } from '../../domain/roomPhoto';
import { motionScrollIntoView } from '../../core/motion';
import { isTemplateId } from '../../domain/roomTemplate';
import { createTemplateSnapshot, saveRoomTemplate } from './templates';
import { templateKeys } from './templateStorage';
import './room-studio.css';
import './room-templates.css';

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
type PhotoEntry = {id:string;file?:File;sample?:number;removing:boolean};
function PhotoTile({entry,index,onRemove,onExit}:{entry:PhotoEntry;index:number;onRemove:()=>void;onExit:()=>void}) {
  const presence=useMotionPresence(!entry.removing);
  useEffect(()=>{if(!presence.isPresent)onExit();},[presence.isPresent,onExit]);
  if(!presence.isPresent)return null;
  return <div className="rc-photo motion-presence" data-motion-state={presence.state} inert={entry.removing} aria-hidden={entry.removing||undefined}>
    {entry.file?<PhotoImage file={entry.file}/>:<ReferenceSvg page={3} index={3+(entry.sample??0)*2}/>}
    <button type="button" className="rc-photo-remove motion-control" disabled={entry.removing} aria-label={`写真${index+1}を削除`} onClick={onRemove}><ReferenceSvg page={3} index={4}/></button>
  </div>;
}
// 第1部で今の部屋を、第2部で作りたい部屋を聞く。
type InputStep = 'room' | 'request';
const stepLabels: Record<InputStep,string> = {room:'今の部屋',request:'作りたい部屋'};
const stepQuestions: Record<InputStep,string> = {room:'現在のあなたの部屋を教えてください。',request:'どんな部屋にしたいですか？'};
function Intro({step}:{step:InputStep|undefined}) {
  return <div className="rc-assistant motion-enter"><span className="rc-assistant-icon"><ReferenceSvg page={3} index={2}/></span><div className="rc-assistant-body" aria-live="polite"><span className="rc-assistant-name">へやいろ</span>
    <p>{step?stepQuestions[step]:'入力できる項目を確認しています。'}</p>
  </div></div>;
}
function InputProgress({steps,current}:{steps:InputStep[];current:InputStep}) {
  const index=steps.indexOf(current);
  return <ol className="rc-input-progress" aria-label="部屋の入力手順">{steps.map((step,position)=><li key={step} aria-current={position===index?'step':undefined} className={`motion-control${position<index?' is-complete':''}`}><span>{position+1}</span>{stepLabels[step]}</li>)}</ol>;
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
  if(!saved.data||(isApiRoomAlias(id)&&(saved.isFetching||saved.isError))) return <main className="rc-missing-room motion-enter">
    <Link className="rc-back" to="/rooms" aria-label="ルーム一覧に戻る"><ReferenceSvg page={3} index={0}/></Link>
    {saved.isPending||saved.isFetching?<p role="status">読み込み中…</p>:<><ErrorText error={saved.error}/><button className="rc-secondary" onClick={()=>void saved.refetch()}>再試行</button></>}
  </main>;
  if(saved.data && saved.data.id!==id) return <Navigate to={`/rooms/${encodeURIComponent(saved.data.id)}`} replace/>;
  return <LoadedRoomStudioPage key={id} initialDesign={saved.data}/>;
}
function LoadedRoomStudioPage({initialDesign}:{initialDesign:RoomDesign}) {
  const {id='new'}=useParams();
  const isNew=id==='new';
  const isTemplate=isTemplateId(id);
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
  const canCoordinate=!isTemplate&&(capability.data?.coordination??false);
  const [tatami,setTatami]=useState(design.analysisInput?.tatami??6);
  const [shape,setShape]=useState<RoomShape>(design.analysisInput?.shape??'standard');
  const analysisPrompt=`${tatami}畳・${shapeLabel(shape)}の部屋を3Dで確認したい。`;
  const [prompt,setPrompt]=useState(inputState?.prompt??(isNew?'':design.prompt??(analyzed?'':samplePrompt)));
  const existingFurniture=existingItems(design);
  const [furnitureOperations,setFurnitureOperations]=useState<FurnitureOperation[]>(()=>design.furnitureOperations??existingFurniture.map(item=>({objectId:item.id,action:'keep'})));
  const [furnitureAdditions,setFurnitureAdditions]=useState<FurnitureAddition[]>(()=>identifyFurnitureAdditions(design.furnitureAdditions??[]));
  const selectsFurniture=analysisMode&&canCoordinate&&!isNew&&design.source==='api'&&!!design.backendRoomId;
  const [message,setMessage]=useState('');
  // 選ぶまでは未指定にし、雰囲気に合う色の先頭を選んだ状態にする。
  const [roomPaletteId,setRoomPaletteId]=useState<string|undefined>(design.roomPaletteId);
  const [characterThemeId,setCharacterThemeId]=useState<string|undefined>(design.characterThemeId);
  // 追加の指示は現在の部屋を修正する。APIに保存されていない部屋だけは、同じ広さ・形で作り直す。
  const canModify=Boolean(design.source==='api'&&design.backendRoomId);
  const [generationPhase,setGenerationPhase]=useState<RoomGenerationPhase>('analyzing');
  const [style,setStyle]=useState<Style>(isNew?'oshi':design.style);
  const [preset,setPreset]=useState<number|null>(null);
  const [stepIndex,setStepIndex]=useState(0);
  const wantsPalette=canCoordinate||loadConnection()==='dummy';
  // 解析した部屋にコーディネートを頼める接続先では、第2部を部屋の3Dモデルができた後の画面で聞く。
  const asksRequestLater=analysisMode&&canCoordinate;
  const inputSteps: InputStep[]=capability.data?[...(analysisMode||acceptsPhotos?['room' as const]:[]),...(wantsPalette&&!asksRequestLater?['request' as const]:[])]:[];
  const progressSteps: InputStep[]=asksRequestLater?['room','request']:inputSteps;
  const inputStep=inputSteps[stepIndex];
  const lastInputStep=stepIndex===inputSteps.length-1;
  const [photoEntries,setPhotoEntries]=useState<PhotoEntry[]>(()=>{const files=inputState?.photos?.filter(file=>file instanceof File)??[];return files.length?files.map(file=>({id:crypto.randomUUID(),file,removing:false})):loadConnection()==='dummy'?[0,1,2].map(sample=>({id:`sample-${sample}`,sample,removing:false})):[];});
  const photos=photoEntries.filter(entry=>!entry.removing&&entry.file).map(entry=>entry.file!);
  const samplePhotos=photoEntries.filter(entry=>!entry.removing&&entry.sample!==undefined).map(entry=>entry.sample!);
  const [photoDrop,setPhotoDrop]=useState(false);
  const [photoError,setPhotoError]=useState('');
  const [notice,setNotice]=useState(inputState?.notice??'');
  const [selectedId,setSelectedId]=useState<string|null>(inputState?.selectedId??design.items.find(item=>item.id==='3')?.id??design.items.find(item=>!item.existing)?.id??null);
  const [panel,setPanel]=useState(!analyzed||!!inputState?.selectedId);
  const [editing,setEditing]=useState(inputState?.editing??analyzed);
  const [focusPanel,setFocusPanel]=useState(false);
  const panelPresence=useMotionPresence(panel);
  const panelScroll=useRef({edit:0,products:0});
  const savePanelScroll=useCallback((mode:'edit'|'products',position:number)=>{panelScroll.current[mode]=position;},[]);
  const [view,setView]=useState<PlannerView>(inputState?.view??'perspective');
  const [placementItem,setPlacementItem]=useState<RoomItem|null>(null);
  const [dimensions,setDimensions]=useState(inputState?.dimensions??false);
  const [history,setHistory]=useState<{past:RoomDesign[];future:RoomDesign[]}>({past:[],future:[]});
  const [savedFingerprint,setSavedFingerprint]=useState(()=>JSON.stringify(design));
  const templateWarning=useQuery({queryKey:templateKeys(scope).warning,queryFn:()=>'',initialData:'',staleTime:Infinity}).data;
  const dirty=JSON.stringify(design)!==savedFingerprint;
  const [before,setBefore]=useState(false);
  const placementDisabled=before||Boolean(design.modelUrl&&design.modelKind!=='shell');
  const [filter,setFilter]=useState('all');
  const [templateName,setTemplateName]=useState<string|null>(null);
  const templateDialog=useRef<HTMLDialogElement>(null);
  const templateMotion = useMotionDialog(templateDialog, templateName !== null, () => setTemplateName(null));
  const [rename,setRename]=useState(false);
  const [title,setTitle]=useState(design.title);
  const upload=useRef<HTMLInputElement>(null);
  const header=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const element=header.current;const studio=element?.parentElement;if(!element||!studio)return;
    const measure=()=>studio.style.setProperty('--rc-header-bottom',`${Math.max(0,element.getBoundingClientRect().bottom)}px`);
    measure();const observer=new ResizeObserver(measure);observer.observe(element);window.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);studio.style.removeProperty('--rc-header-bottom');};
  },[]);
  const messages=useRef<HTMLDivElement>(null);
  const composer=useRef<HTMLFormElement>(null);
  const nearBottom=useRef(true);
  const focusStep=useRef(false);
  const focusPhoto=useRef(false);
  const wasPending=useRef(false);
  useLayoutEffect(()=>{if(focusPhoto.current){composer.current?.querySelector<HTMLElement>('.rc-photo-add')?.focus();focusPhoto.current=false;}},[photos.length,samplePhotos.length]);
  useLayoutEffect(()=>{if(focusStep.current){composer.current?.querySelector<HTMLElement>('input:not([type=hidden]),textarea,button:not(:disabled)')?.focus();focusStep.current=false;}},[inputStep]);
  useEffect(()=>{if(nearBottom.current&&messages.current)motionScrollIntoView(messages.current.lastElementChild,{block:'end'});},[inputStep,design.id]);
  const abort=useRef<AbortController|null>(null);
  const renameDialogRef=useRef<HTMLDialogElement>(null);
  const renameDialog=useMotionDialog(renameDialogRef,rename,()=>setRename(false));
  useEffect(()=>()=>abort.current?.abort(),[]);
  function requireOwner():boolean {
    if(session.status==='authenticated')return true;
    navigate('/login',{state:{from:location.pathname}});
    return false;
  }
  const generation=useMutation({
    mutationFn:async({request,targetStyle,analyzeOnly,followup=false,createNew=false}:{request:string;targetStyle?:Style;analyzeOnly?:boolean;followup?:boolean;createNew?:boolean})=>{
      const controller=new AbortController();abort.current=controller;
      setGenerationPhase(photos.length&&isNew&&!createNew?'uploading':'analyzing');
      const token=tokenStore.load();
      // 追加の指示のときは前回のコーデを渡し、指示に関係ない商品を残してもらう
      const baseCoordinationId=!createNew&&(followup||design.editedItems?.some(item=>item.furnitureDetailId&&!item.existing))&&design.source==='api'&&design.kind==='coordination'?design.id.replace(/^api-coordination-/,''):undefined;
      const roomId=!createNew&&!isNew&&!id.startsWith('sample-')
        ? design.backendRoomId??(loadConnection()==='dummy'&&design.id.startsWith('dummy-room-')?design.id:undefined)
        : undefined;
      const useCurrentFurniture=selectsFurniture&&!createNew;
      const input={characterThemeId,roomPaletteId:suggestedRoomPaletteId(request,roomPaletteId)??roomPaletteId,onProgress:(phase:RoomGenerationPhase)=>{if(!controller.signal.aborted)setGenerationPhase(phase);},baseCoordinationId,photos:createNew?[]:photos,prompt:request,style:targetStyle??style,tatami,shape,roomId,keptObjectIds:useCurrentFurniture?existingFurniture.filter(item=>(furnitureOperations.find(operation=>operation.objectId===item.id)?.action??'keep')==='keep').map(item=>item.id):undefined,furnitureOperations:useCurrentFurniture?existingFurniture.map(item=>({objectId:item.id,action:furnitureOperations.find(operation=>operation.objectId===item.id)?.action??'keep'})):undefined,furnitureAdditions:useCurrentFurniture?furnitureAdditions:undefined,editedItems:useCurrentFurniture?[...new Map([...existingFurniture,...(design.editedItems??[]).filter(item=>!item.existing&&design.items.some(current=>current.id===item.id))].map(item=>{const original=existingFurniture.find(value=>value.id===item.id);return [item.id,original&&isManualFurniture(original)&&!item.existing?{...original,position:item.position,size:item.size,rotation:item.rotation,color:item.color,replacementFurnitureDetailId:Number(item.furnitureDetailId)}:item] as const;})).values()]:undefined};
      const result=await (analyzeOnly?rooms.analyze(input,controller.signal):rooms.generate(input,controller.signal));
      if(controller.signal.aborted||tokenStore.load()!==token) throw new DomainError("ログイン状態が変わりました。もう一度お試しください。");
      return result;
    },
    onSuccess:(result,variables)=>{
      const editedItems=(variables.createNew?[]:design.editedItems??[]).filter(item=>item.existing||result.items.some(current=>current.id===item.id));
      const references=new Map((variables.createNew?[]:existingFurniture).filter(item=>item.referenceImage||item.artwork).map(item=>[item.id,{referenceImage:item.referenceImage,artwork:item.artwork}]));
      const preserveReference=(item:RoomItem):RoomItem=>references.has(item.id)&&(isManualFurniture(item)||isTemplateFurniture(item))?{...item,...references.get(item.id)}:item;
      const saved={...result,items:result.items.map(preserveReference),...(result.before?{before:{...result.before,items:result.before.items.map(preserveReference)}}:{}),characterThemeId:result.characterThemeId??characterThemeId,roomPaletteId:result.roomPaletteId??suggestedRoomPaletteId(variables.request,roomPaletteId)??roomPaletteId,...(!variables.analyzeOnly&&editedItems.length?{editedItems}:{}),...(result.kind==='analysis'&&canCoordinate?{prompt:variables.request.trim()||undefined}:{}),id:result.id};
      let storageNotice: string|undefined;
      try {saveRoomPlan(client,saved,scope);}catch{client.setQueryData(roomPlanKeys.detail(saved.id),saved);if(!rooms.persistenceWarning?.()){storageNotice='ブラウザに保存できませんでした。保存容量を確認してください。';setNotice(storageNotice);}}
      setSavedFingerprint(JSON.stringify(saved));setHistory({past:[],future:[]});
      setFurnitureOperations(saved.furnitureOperations??(saved.before?.items??saved.items).filter(item=>item.existing).map(item=>({objectId:item.id,action:'keep'})));
      setFurnitureAdditions(identifyFurnitureAdditions(saved.furnitureAdditions??[]));
      navigate(`/rooms/${saved.id}`,{state:{prompt:result.kind==='analysis'&&canCoordinate?variables.request:saved.prompt??(result.kind==='analysis'?analysisPrompt:variables.request),photos:result.analysisInput?[]:photos,editing:result.kind==='analysis',notice:storageNotice}});
    },
  });
  const additions=design.items.filter(item=>!item.existing);
  const total=additions.reduce((sum,item)=>sum+(item.price??0),0);
  const referenceStory=design.source==='demo'&&design.style==='oshi'&&additions.length===8&&additions.find(item=>item.id==='3')?.color==='#bba5ee';
  const referenceBase=rooms.demo('oshi');
  const referenceLayout=design.source==='demo'&&design.style==='oshi'&&additions.length===8&&!design.wallColor&&design.items.every(item=>{const original=referenceBase.items.find(base=>base.id===item.id);return original&&JSON.stringify(item.position)===JSON.stringify(original.position)&&JSON.stringify(item.size)===JSON.stringify(original.size)&&item.color===original.color&&!(item.rotation??0);});
  const pending=generation.isPending;
  useLayoutEffect(()=>{if(wasPending.current&&!pending){const target=composer.current?.querySelector<HTMLElement>('input:not([type=hidden]),textarea,button:not(:disabled)')??document.getElementById(analyzed?'coordinate-request':'res-msg');target?.focus();}wasPending.current=pending;},[pending,analyzed]);
  function addPhotos(files:File[]) {
    const errors:string[]=[];
    const selected=[...photos];
    const valid:File[]=[];
    for(const file of files){const error=roomPhotoValidationError(file);if(error){errors.push(error);continue;}
      if(selected.some(previous=>previous.name===file.name&&previous.size===file.size&&previous.lastModified===file.lastModified))continue;
      if(selected.length>=roomPhotoLimits.maxCount){errors.push('写真は最大4枚です。');continue;}
      selected.push(file);valid.push(file);
    }
    if(valid.length)setPhotoEntries(previous=>[...previous.map(entry=>entry.sample!==undefined?{...entry,removing:true}:entry),...valid.map(file=>({id:crypto.randomUUID(),file,removing:false}))]);
    setPhotoError([...new Set(errors)].join(' '));
  }
  function changeStep(index:number) {
    focusStep.current=true;setStepIndex(index);setPhotoDrop(false);setPhotoError('');generation.reset();
  }
  function start(event:FormEvent) {
    event.preventDefault();setNotice('');
    if(!capability.data||!inputStep)return;
    if(inputStep==='request'&&!prompt.trim()){setPhotoError('作りたい部屋の雰囲気を入力してください。');return;}
    if(inputStep==='request'&&prompt.length>(analysisMode?500:2000)){setPhotoError(`雰囲気は${analysisMode?500:2000}文字以内で入力してください。`);return;}
    if(inputStep==='room'&&analysisMode&&(!Number.isFinite(tatami)||tatami<3||tatami>30)){setPhotoError('部屋の広さは3〜30畳で入力してください。');return;}
    if(inputStep==='room'&&!analysisMode&&photos.length<3&&samplePhotos.length<3){setPhotoError('部屋の写真を3〜4枚追加してください。');return;}
    if(!lastInputStep){changeStep(stepIndex+1);return;}
    if(!capability.data.generation){setPhotoError(capability.data.message);return;}
    setPhotoError('');
    if(analysisMode)generation.mutate({request:inputSteps.includes('request')?prompt.trim():asksRequestLater?'':analysisPrompt,analyzeOnly:canCoordinate});
    else generation.mutate({request:prompt.trim()});
  }
  function followup(event:FormEvent) {
    event.preventDefault();if(!message.trim()||!requireOwner())return;
    if(!canCoordinate){setNotice('コーディネートは利用できません。');return;}
    if(!capability.data?.generation){setNotice('コーディネートは利用できません。');return;}
    if(loadConnection()==='dummy'&&!/落ち着いた紫|グリーン/.test(message)){setNotice('この変更はサンプルでは利用できません。');return;}
    generation.mutate({request:message.trim(),targetStyle:/グリーン/.test(message)?'botanical':style,followup:true,createNew:!canModify});
  }
  function coordinate(event:FormEvent) {
    event.preventDefault();
    if(!requireOwner())return;
    if(!prompt.trim()){setPhotoError('作りたい部屋の雰囲気を入力してください。');return;}
    setPhotoError('');generation.mutate({request:prompt.trim(),createNew:!canModify});
  }
  function changeTitle(event:FormEvent) {event.preventDefault();if(!requireOwner())return;const value=title.trim();if(!value)return;try{const next={...design,title:value};if(isTemplate)saveRoomTemplate(client,scope,next);else saveRoomPlan(client,next,scope);setSavedFingerprint(JSON.stringify(next));setRename(false);}catch{setNotice('ルーム名を保存できませんでした。');}}
  function editDesign(next:RoomDesign) {
    next={...next,items:next.items.map(item=>{
      if(!item.supportObjectId)return item;
      const previousSupport=design.items.find(support=>support.id===item.supportObjectId);
      const support=next.items.find(support=>support.id===item.supportObjectId);
      // Same-ID product replacement can change the mesh without changing its bounds.
      const geometryIdentity=(value:RoomItem|undefined)=>value&&[value.category,value.modelUrl,value.modelSize,value.modelFit];
      const geometryChanged=JSON.stringify(geometryIdentity(previousSupport))!==JSON.stringify(geometryIdentity(support));
      return geometryChanged||furnitureSurfaceHeight(item,item.position,next)===null?{...item,supportObjectId:undefined,supportSurface:undefined,position:[item.position[0],getFurniturePlacementBounds(next).floor+item.size[1]/2,item.position[2]]}:item;
    })};
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
  function moveItem(itemId:string, position:RoomItem['position'], supportObjectId?:string, supportSurface?:RoomItem['supportSurface']) {
    if(!editing||before||(design.modelUrl&&design.modelKind!=='shell'))return;
    const item=design.items.find(item=>item.id===itemId);if(!item)return;
    const boundedPosition=snapFurnitureEditPosition({...item,supportObjectId,supportSurface},position,[0,2],design);if(!boundedPosition)return;
    editDesign({...design,items:design.items.map(value=>value.id===itemId?{...value,position:boundedPosition,supportObjectId,supportSurface}:value)});
  }
  function addItem(candidate:RoomItem,position?:RoomItem['position'],supportObjectId?:string,supportSurface?:RoomItem['supportSurface']) {
    setPlacementItem(null);
    if(!editing||placementDisabled)return;
    if(candidate.artwork&&design.items.reduce((total,item)=>total+(item.artwork?.dataUrl.length??0),0)+candidate.artwork.dataUrl.length>1024*1024){setNotice('この部屋の推しグッズ画像は合計1MBまでです。グッズを削除してから追加してください。');return;}
    const boundedPosition=furniturePositionInRoom({...candidate,supportObjectId,supportSurface},position??candidate.position,design);
    if(!boundedPosition){setNotice('この寸法の家具は部屋に収まりません。寸法を小さくしてください。');return;}
    const item={...candidate,id:`manual-${crypto.randomUUID()}`,position:boundedPosition,supportObjectId,supportSurface};
    editDesign({...design,items:[...design.items,item]});
    setSelectedId(item.id);setBefore(false);
  }
  function startPlacement(item:RoomItem|null) {
    if(item&&(!editing||placementDisabled))return;
    if(item&&view==='front')setView('top');
    setPlacementItem(item);
  }
  function removeItem(itemId:string) {
    if(!editing||placementDisabled||(!isTemplate&&!itemId.startsWith('manual-')))return;
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
      if(isTemplate)saveRoomTemplate(client,scope,saved);else saveRoomPlan(client,saved,scope);setSavedFingerprint(JSON.stringify(saved));
      if(saved.id!==id)navigate(`/rooms/${saved.id}`,{state:{prompt,photos,editing:true,view,selectedId,dimensions}});
      else setNotice('保存しました。');
    }catch{setNotice('変更を保存できませんでした。ブラウザの保存容量を確認してください。');}
  }
  function saveAsTemplate(event:FormEvent) {
    event.preventDefault();if(!requireOwner()||!templateName?.trim())return;
    try {saveRoomTemplate(client,scope,createTemplateSnapshot(design,templateName));setTemplateName(null);setNotice('テンプレートを保存しました。テンプレート一覧から編集・再利用できます。');}
    catch(error){setNotice(error instanceof Error?error.message:'テンプレートを保存できませんでした。');}
  }
  return <div className="rc-studio">
    <header ref={header} className={`rc-studio-header${isNew?' motion-enter':''}`}><Link className="rc-back" to={isTemplate?'/room-templates':'/rooms'} aria-label={isTemplate?'テンプレート一覧に戻る':'ルーム一覧に戻る'} title={isTemplate?'テンプレート一覧':'ルーム一覧'}><ReferenceSvg page={3} index={0}/></Link><span className="rc-header-divider"/><div className={`rc-title${isNew?' is-new':''}`}>{isTemplate&&<span className="rc-template-badge">テンプレート</span>}<h1>{isNew?'新しいルーム':design.title}</h1>{!isNew&&<button type="button" aria-label="ルーム名を変更" onClick={()=>{setTitle(design.title);setRename(true);}}><ReferenceSvg page={5} index={1}/></button>}</div><nav className="rc-template-actions" aria-label="テンプレート"><Link className="rc-secondary" to="/room-templates">テンプレート一覧</Link></nav><AccountMenu onEditLayout={!isNew&&id!=='sample-game'?()=>{setEditing(true);setFocusPanel(true);setPanel(true);setBefore(false);}:undefined}/></header>
    <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden aria-describedby="room-photo-requirements" onChange={event=>{addPhotos(Array.from(event.target.files??[]));event.target.value='';}}/>
    <div className={`rc-workspace${pending||id==='sample-game'?' is-generating':''}`}>
      {pending||id==='sample-game'?<RoomGenerating design={isNew||id==='sample-game'?undefined:design} phase={generationPhase} prompt={generation.variables?.analyzeOnly?analysisPrompt:generation.variables?.request??(analysisMode?analysisPrompt:prompt)} photos={acceptsPhotos?photos:[]} sample={loadConnection()==='dummy'} dimensions={analysisMode} coordination={canCoordinate&&!generation.variables?.analyzeOnly} onCancel={()=>{if(pending){abort.current?.abort();generation.reset();setNotice('生成を停止しました。');}else navigate('/rooms');}}/>:<>
        <section className="rc-chat" aria-label="チャット">
          {isNew?<>
            <div ref={messages} onScroll={event=>{const node=event.currentTarget;nearBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<64;}} className="rc-messages is-new">{stepIndex>0&&<div className="rc-input-summary">{inputSteps.slice(0,stepIndex).map(step=><p className="motion-enter" key={step}>{step==='room'?[analysisMode&&`${tatami}畳・${shapeLabel(shape)}`,acceptsPhotos&&`写真 ${photos.length||samplePhotos.length}枚`].filter(Boolean).join(' / '):prompt}</p>)}</div>}<Intro key={inputStep} step={inputStep}/></div>
            <form ref={composer} className={`rc-new-composer${photoDrop?' is-photo-drop':''}`} onSubmit={start} onDragOver={event=>{event.preventDefault();if(inputStep==='room'&&acceptsPhotos&&event.dataTransfer.types.includes('Files'))setPhotoDrop(true);}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setPhotoDrop(false);}} onDrop={event=>{event.preventDefault();setPhotoDrop(false);if(inputStep==='room'&&acceptsPhotos)addPhotos(Array.from(event.dataTransfer.files));}}>
              {inputStep&&progressSteps.length>1&&<InputProgress steps={progressSteps} current={inputStep}/>}
              <div key={inputStep} className="rc-setup-step motion-enter">{inputStep==='room'&&<>
              {analysisMode&&<div className="rc-analysis-settings"><label className="rc-setting" htmlFor="room-tatami">部屋の広さ<span className="rc-tatami-input"><input id="room-tatami" type="number" min={3} max={30} step="0.5" value={Number.isNaN(tatami)?'':tatami} onChange={event=>setTatami(event.target.valueAsNumber)} required/>畳</span></label>
              <fieldset><legend>部屋の形</legend><div className="rc-shape-options">{roomShapes.map(item=><button key={item.value} type="button" className="motion-control" aria-pressed={shape===item.value} onClick={()=>setShape(item.value)}>{item.label}</button>)}</div></fieldset></div>}
              {acceptsPhotos&&<><div className="rc-photo-heading"><span>部屋の写真{analysisMode&&'（任意）'}</span><span><strong key={photos.length||samplePhotos.length} className="motion-fade">{photos.length||samplePhotos.length}</strong> / {roomPhotoLimits.maxCount}枚</span></div>
              <p id="room-photo-requirements" className="rc-photo-requirements">{roomPhotoRequirements}</p>
              <div className="rc-photos">{photoEntries.map((entry,index)=><PhotoTile key={entry.id} entry={entry} index={index} onRemove={()=>{focusPhoto.current=true;setPhotoEntries(previous=>previous.map(item=>item.id===entry.id?{...item,removing:true}:item));}} onExit={()=>setPhotoEntries(previous=>previous.filter(item=>item.id!==entry.id))}/>)}{(photos.length||samplePhotos.length)<roomPhotoLimits.maxCount&&<button type="button" className="rc-photo-add" aria-label="写真を追加（撮影またはライブラリ）" aria-describedby="room-photo-requirements" onClick={()=>upload.current?.click()}><ReferenceSvg page={3} index={9}/>追加</button>}</div>
              </>}
              {analysisMode&&<RoomTemplateChooser/>}
              </>}
              {inputStep==='request'&&<><div className="rc-presets">{presets.map((item,index)=><button type="button" className="motion-control" key={item.label} aria-pressed={preset===index} onClick={()=>{setPreset(index);setStyle(item.style);setPrompt(item.prompt);}}>{item.label}</button>)}</div><div className="rc-request-box"><label className="rc-sr-only" htmlFor="new-request">作りたい部屋の雰囲気</label><textarea id="new-request" rows={3} placeholder="例：木の温もりを感じる、落ち着いた部屋にしたい" value={prompt} maxLength={analysisMode?500:2000} onChange={event=>setPrompt(event.target.value)} required/></div></>}
              {inputStep==='request'&&<RoomPalettePicker atmosphere={prompt} value={roomPaletteId} onChange={setRoomPaletteId}/>}
              {inputStep==='request'&&prompt.trim()&&<CharacterThemePicker value={characterThemeId} onChange={value=>{setCharacterThemeId(value);if(value)setStyle('oshi');}}/>}
              </div><div className="rc-input-actions">{stepIndex>0&&<button type="button" className="rc-secondary" onClick={()=>changeStep(stepIndex-1)}>戻る</button>}<button type="submit" className="rc-primary" disabled={!inputStep}>{!lastInputStep?'次へ':asksRequestLater?'部屋の3Dモデルを作る':analysisMode?'部屋を作成する':'コーディネートを始める'}<ReferenceSvg page={3} index={10}/></button></div>

              <ErrorText error={capability.error}/>
              {photoError&&<p className="rc-error" role="alert">{photoError}</p>}<ErrorText error={generation.error}/>
            </form>
          </>:<>
            <div ref={messages} onScroll={event=>{const node=event.currentTarget;nearBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<64;}} className="rc-messages">
              <div key={`user-${design.id}`} className="rc-user-message motion-enter">{!design.analysisInput&&<div className="rc-user-photos">{photos.length?photos.map(file=><div key={`${file.name}-${file.size}-${file.lastModified}`}><PhotoImage file={file}/></div>):[3,4,5,6].map(index=><div key={index}><ReferenceSvg page={5} index={index}/></div>)}</div>}<p>{design.kind==='analysis'&&design.analysisInput?`${design.analysisInput.tatami}畳・${shapeLabel(design.analysisInput.shape)}の部屋を3Dで確認したい。`:prompt}</p></div>
              <div key={`result-${design.id}`} className="rc-assistant motion-enter"><span className="rc-assistant-icon"><ReferenceSvg page={5} index={7}/></span><div className="rc-assistant-body"><span className="rc-assistant-name">へやいろ</span><span className="rc-complete"><ReferenceSvg page={5} index={8}/>{isTemplate?'テンプレート':design.description==='保存したテンプレートから作成した部屋です。'?'作成完了':design.source==='demo'?'サンプル':analyzed?'解析完了':'コーディネート完了'}</span><p>{referenceStory?'今あるベッドとデスクはそのままに、紫をアクセントにした推し活ルームにしました。':roomDescription(design.description)}</p>
                {analyzed&&!isTemplate&&<button type="button" className="rc-template-save" onClick={()=>setTemplateName(design.title)}>この部屋をテンプレートに保存</button>}
                {referenceStory&&<ul className="rc-bullets"><li>壁の上部にLEDテープを回して、夜は紫の間接照明に</li><li>ベッドの足元に、アクスタを飾れるひな壇シェルフ</li><li>ラグ・クッション・ベッドカバーをラベンダー系で統一</li></ul>}
                {!analyzed&&<div className="rc-summary motion-fade"><div className="rc-summary-heading"><span>コーディネート案</span><span>{additions.length}アイテム · <span className="rc-money">{money(total)}</span></span></div><div className="rc-summary-actions"><button type="button" className="rc-primary" onClick={()=>{setEditing(false);setFocusPanel(true);setPanel(true);}}><ReferenceSvg page={5} index={9}/>アイテム一覧</button><button type="button" className="rc-secondary" onClick={()=>setBefore(old=>!old)}>Before / After</button></div></div>}
              </div></div>
              {canCoordinate&&!analyzed&&<CharacterThemePicker value={characterThemeId} onChange={setCharacterThemeId}/>}
              {canCoordinate&&!analyzed&&<div className="rc-followups">{['もう少し落ち着いた紫に','グリーンも足したい'].map(text=><button type="button" className="motion-control" key={text} onClick={()=>setMessage(text)}>{text}</button>)}</div>}
              {canCoordinate&&analyzed&&<div key={`request-${design.id}`} className="rc-assistant motion-enter"><span className="rc-assistant-icon"><ReferenceSvg page={5} index={7}/></span><div className="rc-assistant-body"><span className="rc-assistant-name">へやいろ</span><p>{stepQuestions.request}</p></div></div>}
              {canCoordinate&&analyzed&&<form className="rc-coordinate-form" onSubmit={coordinate}>
                <InputProgress steps={['room','request']} current="request"/>
                <div className="rc-presets">{presets.map((item,index)=><button type="button" className="motion-control" key={item.label} aria-pressed={preset===index} onClick={()=>{setPreset(index);setStyle(item.style);setPrompt(item.prompt);}}>{item.label}</button>)}</div>
                <label className="rc-setting" htmlFor="coordinate-request">作りたい部屋の雰囲気<textarea id="coordinate-request" rows={3} value={prompt} maxLength={500} onChange={event=>setPrompt(event.target.value)} required/></label>
                <RoomPalettePicker atmosphere={prompt} value={roomPaletteId} onChange={setRoomPaletteId}/>
                {prompt.trim()&&<CharacterThemePicker value={characterThemeId} onChange={value=>{setCharacterThemeId(value);if(value)setStyle('oshi');}}/>}
                <button type="submit" className="rc-primary">この部屋で作成</button>

                {photoError&&<p className="rc-error" role="alert">{photoError}</p>}
              </form>}
              <ErrorText error={generation.error}/>
            </div>
            {canCoordinate&&analyzed?null:canCoordinate?<form className="rc-followup-composer" onSubmit={followup}><div className="rc-followup-input">{!analysisMode&&<button type="button" aria-label="写真を追加" onClick={()=>upload.current?.click()}><ReferenceSvg page={5} index={10}/></button>}<label className="rc-sr-only" htmlFor="res-msg">メッセージ</label><textarea id="res-msg" rows={1} placeholder="変えたいところを伝えてください" value={message} maxLength={analysisMode?500:2000} onChange={event=>setMessage(event.target.value)}/><button type="submit" aria-label="送信" ><ReferenceSvg page={5} index={11}/></button></div><RoomPalettePicker atmosphere={message} value={roomPaletteId} onChange={setRoomPaletteId}/>{photoError&&<p className="rc-error" role="alert">{photoError}</p>}</form>:<div className="rc-followup-composer rc-analysis-note">{isTemplate?'配置と色を編集し、変更を保存してください。部屋の作成はテンプレート一覧から行えます。':'コーディネートは利用できません。'}</div>}
          </>}
        </section>
        {isNew?<EmptyScene/>:<RoomScene key={design.id} design={design} panel={panelPresence.isPresent} before={before} filter={filter} selectedId={selectedId} referenceLayout={referenceLayout} editing={editing} view={view} dimensions={dimensions} onSelect={value=>{setSelectedId(value);setFocusPanel(true);setPanel(true);setFilter('all');const item=design.items.find(item=>item.id===value);if(analyzed||item){setEditing(true);setBefore(false);}}} onBefore={value=>{setPlacementItem(null);setBefore(value);}} onMoveItem={moveItem} placementItem={placementItem} onPlaceItem={(position,supportObjectId,supportSurface)=>{if(placementItem)addItem(placementItem,position,supportObjectId,supportSurface);}} onOpenPanel={()=>{setFocusPanel(true);setPanel(true);if(analyzed)setEditing(true);}}>{panelPresence.isPresent&&<RoomPanelTransition open={panel} focusOnMount={focusPanel} mode={editing?'edit':'products'} scrollPositions={panelScroll} onScrollPositionChange={savePanelScroll}>{shownMode=>shownMode==='edit'?<PlannerPanel onAddItem={addItem} onDragItem={startPlacement} onRemoveItem={removeItem} placementDisabled={placementDisabled} placementHint={before?'Afterに切り替えると家具を追加できます。':undefined} design={design} templateEditing={isTemplate} selectedId={selectedId} onSelect={setSelectedId} furnitureRequests={selectsFurniture?{existingItems:existingFurniture,operations:furnitureOperations,additions:furnitureAdditions,onOperationChange:(objectId,action)=>setFurnitureOperations(previous=>[...previous.filter(operation=>operation.objectId!==objectId),{objectId,action}]),onAdditionsChange:setFurnitureAdditions}:undefined} onChange={editDesign} onUndo={undo} onRedo={redo} canUndo={history.past.length>0} canRedo={history.future.length>0} dirty={dirty} onSave={saveEdits} onClose={()=>{setPlacementItem(null);setEditing(false);setPanel(false);}} onProducts={()=>{setPlacementItem(null);setEditing(false);}} view={view} onView={setView} dimensions={dimensions} onDimensions={setDimensions}/>:<RecommendationPanel onEditLayout={()=>{setEditing(true);setBefore(false);}} searchEntryPoints={design.searchEntryPoints} originalItems={design.before?.items} items={additions} selectedId={selectedId} filter={filter} onSelect={setSelectedId} onFilter={setFilter} onClose={()=>setPanel(false)}/> }</RoomPanelTransition>}</RoomScene>}
      </>}
    </div>
    {notice&&<div key={notice} className="rc-notice motion-fade" role="status">{notice}<button className="motion-control" type="button" aria-label="通知を閉じる" onClick={()=>setNotice('')}>×</button></div>}
    {rooms.persistenceWarning?.()&&<div className="rc-notice motion-fade" role="alert">{rooms.persistenceWarning()}</div>}
    <dialog ref={renameDialogRef} className="rc-dialog motion-dialog motion-presence" data-motion-state={renameDialog.state} tabIndex={-1} aria-labelledby="rename-room-title" onKeyDown={renameDialog.onKeyDown} onCancel={renameDialog.onCancel} onClose={renameDialog.onClose} onClick={renameDialog.onClick}><form inert={renameDialog.closing} aria-hidden={renameDialog.closing} onSubmit={changeTitle}><div className="rc-dialog-heading"><h2 id="rename-room-title">ルーム名を変更</h2><button type="button" aria-label="閉じる" onClick={()=>setRename(false)}>×</button></div><label className="rc-setting">ルーム名<input className="motion-field" value={title} onChange={event=>setTitle(event.target.value)} maxLength={80} required autoFocus/></label><p/><button className="rc-primary" type="submit">保存</button></form></dialog>
    {templateWarning&&<div className="rc-notice motion-fade" role="alert">{templateWarning}</div>}
    <dialog ref={templateDialog} className="rc-dialog motion-dialog motion-presence" data-motion-state={templateMotion.state} tabIndex={-1} aria-labelledby="save-template-title" onKeyDown={templateMotion.onKeyDown} onCancel={templateMotion.onCancel} onClose={templateMotion.onClose} onClick={templateMotion.onClick}><form inert={templateMotion.closing} aria-hidden={templateMotion.closing} onSubmit={saveAsTemplate}><div className="rc-dialog-heading"><h2 id="save-template-title">テンプレートに保存</h2><button type="button" aria-label="閉じる" onClick={()=>setTemplateName(null)}>×</button></div><label className="rc-setting">テンプレート名<input className="motion-field" value={templateName??''} onChange={event=>setTemplateName(event.target.value)} maxLength={80} required autoFocus/></label><p>現在の配置と色を、このブラウザに保存します。元の部屋は変更しません。</p><button className="rc-primary" type="submit">保存</button></form></dialog>
  </div>;
}
