import type { ReactNode } from 'react';
import { selectableCharacterThemes } from '../../domain/characterTheme';
import './room-theme-tags.css';

export default function RoomThemeTags({ value, onChange, children }: { value?: string; onChange: (value?: string) => void; children?: ReactNode }) {
  return <div className="rc-presets rc-theme-tags" role="group" aria-label="テーマタグ">
    {children}
    {selectableCharacterThemes.map(theme => <button key={theme.id} type="button" className="motion-control" aria-pressed={value === theme.id} title={theme.instructions} onClick={() => onChange(value === theme.id ? undefined : theme.id)}>{theme.name}</button>)}
  </div>;
}
