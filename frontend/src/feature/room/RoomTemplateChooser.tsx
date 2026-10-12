import { useState } from 'react';
import type { RoomTemplate } from '../../domain/roomTemplate';
import ErrorText from '../shared/ErrorText';
import { useRoomPlanScope } from './plans';
import { useCreateRoomFromTemplate, useRoomTemplates } from './templates';
import { useRoomSnapshots } from './useRoomSnapshots';
import './room-list.css';
import './template-chooser.css';

function TemplateCards({ templates }: { templates: RoomTemplate[] }) {
  const create = useCreateRoomFromTemplate();
  const scope = useRoomPlanScope();
  const { snapshot, studio } = useRoomSnapshots(templates.map(template => template.design), scope);
  return <>
    <ErrorText error={create.error}/>
    <ul className="rc-template-cards">{templates.map(template => {
      const image = snapshot(template.design);
      return <li key={template.id}>
        <button type="button" className="motion-control" disabled={create.isPending} onClick={() => create.mutate(template.design)}>
          <span className="rc-template-thumbnail">{image ? <img src={image} alt={`${template.design.title}の家具配置`} draggable={false}/> : <span role="status">{image === null ? 'プレビューを表示できませんでした' : '部屋の画像を準備中…'}</span>}</span>
          <strong>{template.design.title}</strong>
          <span>{create.isPending && create.variables?.id === template.id ? '部屋を作成中…' : `${template.design.analysisInput?.tatami.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}畳 · ${template.design.items.length}点の家具`}</span>
        </button>
      </li>;
    })}</ul>
    {studio}
  </>;
}

// 開いたときだけ3Dを順番に撮影し、画像を比較して部屋を選べるようにする。
export default function RoomTemplateChooser() {
  const templates = useRoomTemplates();
  const [open, setOpen] = useState(false);
  return <div className="rc-template-chooser">
    <button type="button" className="rc-secondary" aria-expanded={open} aria-controls="room-template-options" onClick={() => setOpen(value => !value)}>既存のテンプレートを使う</button>
    {open && <div id="room-template-options" className="rc-template-options">
      {templates.isPending && <p role="status">読み込み中…</p>}
      <ErrorText error={templates.error}/>
      <TemplateCards templates={templates.data}/>
    </div>}
  </div>;
}
