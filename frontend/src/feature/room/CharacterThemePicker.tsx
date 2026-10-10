import { characterTheme, selectableCharacterThemes } from '../../domain/characterTheme';
import './character-theme.css';

export default function CharacterThemePicker({ value, onChange }: { value?: string; onChange: (value?: string) => void }) {
  const selected = characterTheme(value);
  return <fieldset className="rc-character-themes">
    <legend>キャラクターテーマ</legend>
    <div className="rc-character-options" role="group" aria-label="キャラクターテーマを選ぶ">
      <button type="button" aria-pressed={!value} onClick={() => onChange(undefined)}>指定しない</button>
      {selectableCharacterThemes.map(theme => <button key={theme.id} type="button" aria-pressed={value === theme.id} onClick={() => onChange(theme.id)}>{theme.name}</button>)}
    </div>
    {selected && <p className="rc-character-description">{selected.instructions}</p>}
    <p className="rc-character-note">キャラクターをイメージした部屋です。公式の画像・グッズが付くとは限りません。</p>
  </fieldset>;
}
