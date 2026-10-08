import { roomPalettes } from '../../domain/roomPalette';
import './room-palette.css';

export default function RoomPalettePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return <fieldset className="rc-room-palette">
    <legend>部屋のカラーテーマ</legend>
    <div className="rc-room-palette-swatches">
      {roomPalettes.map(palette => <label key={palette.id}>
        <input type="radio" name="room-palette" value={palette.id} checked={value === palette.id} onChange={() => onChange(palette.id)} aria-label={palette.name} />
        <span aria-hidden="true" style={{ background: `linear-gradient(90deg, ${palette.base} 0% 50%, ${palette.secondary} 50% 80%, ${palette.accent} 80% 100%)` }} />
      </label>)}
    </div>
  </fieldset>;
}
