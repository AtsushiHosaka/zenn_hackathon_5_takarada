import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useRepositories } from '../../core/repositories';
import type { RoomDesign } from '../../domain/room';
import AccountMenu from './AccountMenu';
import RoomPreview from './RoomPreview';
import ErrorText from '../shared/ErrorText';
import { saveRoomPlan, useRoomPlanScope } from './plans';
import { deleteRoomTemplate, useRoomTemplates } from './templates';
import './room-templates.css';
export default function RoomTemplatePage() {
  const templates = useRoomTemplates();
  const scope = useRoomPlanScope();
  const [previewId,setPreviewId] = useState<string>();
  const activePreview = templates.data.some(template=>template.id===previewId) ? previewId : templates.data[0]?.id;
  const {rooms,tokenStore} = useRepositories();
  const client = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: async (design: RoomDesign) => {
      const token = tokenStore.load();
      const room = await rooms.createFromTemplate(design);
      if (tokenStore.load() !== token) throw new Error('ログイン状態が変わりました。もう一度お試しください。');
      return room;
    },
    onSuccess: room => {
      let notice: string | undefined;
      try {saveRoomPlan(client,room,scope);} catch {notice='このタブでは部屋を使えますが、編集内容をブラウザに保存できませんでした。';}
      navigate(`/rooms/${room.id}`, {state: {editing:true,notice}});
    },
  });
  return <div className="room-template-page"><header><Link to="/rooms">← マイルーム</Link><AccountMenu/></header><main>
    <h1>部屋のテンプレート</h1><p>部屋の配置と色を保存し、何度でも別の部屋を作れます。テンプレートはこのブラウザに利用者別で保存します。</p>
    {templates.isPending && <p role="status">読み込み中…</p>}
    <ErrorText error={templates.error}/><ErrorText error={create.error}/>
    {templates.warning && <p className="rc-error" role="alert">{templates.warning}</p>}
    {!templates.isPending && !templates.error && templates.data.length===0 && <div className="room-template-empty"><p>部屋を開き、「テンプレートに保存」から追加してください。</p><Link className="rc-primary" to="/rooms">部屋を選ぶ</Link></div>}
    <div className="room-template-grid">{templates.data.map(template => <article key={template.id}>
      <div className="room-template-preview">{activePreview===template.id ? <RoomPreview design={template.design}/> : <button type="button" className="room-template-show-preview" onClick={()=>setPreviewId(template.id)} aria-label={`${template.design.title}の3D表示`}>この部屋を3Dで見る</button>}</div><h2>{template.design.title}</h2>
      <p>{template.design.analysisInput?.tatami.toLocaleString('ja-JP',{maximumFractionDigits:1})}畳 · {template.design.items.length}点の家具</p>
      <button className="rc-primary" type="button" disabled={create.isPending} onClick={()=>create.mutate(template.design)}>{create.isPending && create.variables?.id===template.id ? '部屋を作成中…' : 'このテンプレートから作る'}</button>
      <div className="room-template-card-actions"><Link className="rc-secondary" to={`/rooms/${template.id}`}>編集</Link><button type="button" className="rc-secondary" disabled={create.isPending} onClick={()=>deleteRoomTemplate(client,scope,template.id)} aria-label={`${template.design.title}のテンプレートを削除`}>削除</button></div>
    </article>)}</div>
  </main></div>;
}
