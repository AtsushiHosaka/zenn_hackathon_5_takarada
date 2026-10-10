import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import AccountMenu from './AccountMenu';
import RoomPreview from './RoomPreview';
import ErrorText from '../shared/ErrorText';
import { useRoomPlanScope } from './plans';
import { deleteRoomTemplate, useCreateRoomFromTemplate, useRoomTemplates } from './templates';
import { motionStaggerStyle } from '../../core/motion';
import './room-templates.css';
export default function RoomTemplatePage() {
  const templates = useRoomTemplates();
  const scope = useRoomPlanScope();
  const [previewId,setPreviewId] = useState<string>();
  const activePreview = templates.data.some(template=>template.id===previewId) ? previewId : templates.data[0]?.id;
  const client = useQueryClient();
  const create = useCreateRoomFromTemplate();
  return <div className="room-template-page"><header><Link to="/rooms">← マイルーム</Link><AccountMenu/></header><main className="motion-enter">
    <h1>部屋のテンプレート</h1><p>部屋の配置と色を保存し、何度でも別の部屋を作れます。テンプレートはこのブラウザに利用者別で保存します。</p>
    {templates.isPending && <p role="status">読み込み中…</p>}
    <ErrorText error={templates.error}/><ErrorText error={create.error}/>
    {templates.warning && <p className="rc-error" role="alert">{templates.warning}</p>}
    {!templates.isPending && !templates.error && templates.data.length===0 && <div className="room-template-empty"><p>部屋の3Dモデルができた画面の「この部屋をテンプレートに保存」から追加してください。</p><Link className="rc-primary" to="/rooms">部屋を選ぶ</Link></div>}
    <div className="room-template-grid">{templates.data.map((template,index) => <article key={template.id} className="motion-enter" style={motionStaggerStyle(index)}>
      <div className="room-template-preview">{activePreview===template.id ? <RoomPreview design={template.design}/> : <button type="button" className="room-template-show-preview motion-control" onClick={()=>setPreviewId(template.id)} aria-label={`${template.design.title}の3D表示`}>この部屋を3Dで見る</button>}</div><h2>{template.design.title}</h2>
      <p>{template.design.analysisInput?.tatami.toLocaleString('ja-JP',{maximumFractionDigits:1})}畳 · {template.design.items.length}点の家具</p>
      <button className="rc-primary" type="button" disabled={create.isPending} onClick={()=>create.mutate(template.design)}>{create.isPending && create.variables?.id===template.id ? '部屋を作成中…' : 'このテンプレートから作る'}</button>
      <div className="room-template-card-actions"><Link className="rc-secondary" to={`/rooms/${template.id}`}>編集</Link><button type="button" className="rc-secondary" disabled={create.isPending} onClick={()=>deleteRoomTemplate(client,scope,template.id)} aria-label={`${template.design.title}のテンプレートを削除`}>削除</button></div>
    </article>)}</div>
  </main></div>;
}
