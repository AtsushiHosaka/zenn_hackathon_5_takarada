import { useState } from 'react';
import ErrorText from '../shared/ErrorText';
import { useCreateRoomFromTemplate, useRoomTemplates } from './templates';

// 保存した部屋から始める。広さ・形・写真の入力を省ける。
export default function RoomTemplateChooser() {
  const templates = useRoomTemplates();
  const create = useCreateRoomFromTemplate();
  const [open, setOpen] = useState(false);
  return <div className="rc-template-chooser">
    <button type="button" className="rc-secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>既存のテンプレートを使う</button>
    {open && <>
      {templates.isPending && <p role="status">読み込み中…</p>}
      <ErrorText error={templates.error}/><ErrorText error={create.error}/>
      {!templates.isPending && !templates.error && templates.data.length === 0 && <p>保存したテンプレートはまだありません。部屋の3Dモデルができた画面で保存できます。</p>}
      <ul>{templates.data.map(template => <li key={template.id}>
        <button type="button" className="motion-control" disabled={create.isPending} onClick={() => create.mutate(template.design)}>
          <strong>{template.design.title}</strong>
          <span>{create.isPending && create.variables?.id === template.id ? '部屋を作成中…' : `${template.design.analysisInput?.tatami.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}畳 · ${template.design.items.length}点の家具`}</span>
        </button>
      </li>)}</ul>
    </>}
  </div>;
}
