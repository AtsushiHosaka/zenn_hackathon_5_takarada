import { useId, useState, type ReactNode } from 'react';
import { addThemeTag, normalizeThemeTag, suggestedThemeTags, themeTagLimit, themeTagMaxLength } from '../../domain/themeTags';
import './room-theme-tags.css';

export default function RoomThemeTags({ value, onChange, children }: { value: readonly string[]; onChange: (value: readonly string[]) => void; children?: ReactNode }) {
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const full = value.length >= themeTagLimit;
  const suggestions = suggestedThemeTags.filter(tag => !value.includes(tag));
  function add(tag: string) {
    onChange(addThemeTag(value, tag));
    setDraft('');
  }
  return <div className="rc-theme-tags" role="group" aria-label="テーマタグ">
    {children && <div className="rc-presets">{children}</div>}
    <div className="rc-tag-field">
      {value.map(tag => <span key={tag} className="rc-tag">{tag}<button type="button" aria-label={`${tag}を外す`} onClick={() => onChange(value.filter(item => item !== tag))}>×</button></span>)}
      <label className="rc-sr-only" htmlFor={inputId}>タグを追加</label>
      <input id={inputId} type="text" value={draft} maxLength={themeTagMaxLength} disabled={full} placeholder={full ? `タグは${themeTagLimit}個までです` : value.length ? 'タグを追加' : 'タグを追加（例 初音ミク、和風）'} enterKeyHint="done"
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          // 変換を確定する Enter ではタグにしない。
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Enter') { event.preventDefault(); add(draft); }
          else if (event.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}/>
      {normalizeThemeTag(draft) && <button type="button" className="rc-tag-add" onClick={() => add(draft)}>追加</button>}
    </div>
    {!full && suggestions.length > 0 && <div className="rc-tag-suggestions"><span>候補</span>{suggestions.map(tag => <button key={tag} type="button" className="motion-control" onClick={() => add(tag)}>＋ {tag}</button>)}</div>}
  </div>;
}
