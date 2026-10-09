import { suggestRoomPalettes, suggestedRoomPaletteId } from '../../domain/roomPaletteSuggestions';
import './room-palette.css';

export default function RoomPalettePicker({ atmosphere, value, onChange }: { atmosphere: string; value: string; onChange: (id: string) => void }) {
  const palettes = suggestRoomPalettes(atmosphere, value);
  const selectedId = suggestedRoomPaletteId(atmosphere, value);
  return <fieldset className="rc-room-palette">
    <legend>おすすめのカラーテーマ</legend>
    <p className="rc-room-palette-hint">{palettes.length ? 'イメージに近い配色を選んでください。雰囲気を書き直すと候補も変わります。' : '作りたい部屋の雰囲気を文章で教えてください。配色を4つ提案します。'}</p>
    <div className="rc-room-palette-swatches">
      {palettes.map(palette => <label key={palette.id} title={palette.name}>
        <input type="radio" name="room-palette" value={palette.id} checked={selectedId === palette.id} onChange={() => onChange(palette.id)} aria-label={palette.name} />
        <span aria-hidden="true" style={{ background: `linear-gradient(90deg, ${palette.base} 0% 50%, ${palette.secondary} 50% 80%, ${palette.accent} 80% 100%)` }} />
      </label>)}
    </div>
  </fieldset>;
}
