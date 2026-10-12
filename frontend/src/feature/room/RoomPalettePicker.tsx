import { roomColor } from '../../domain/roomPalette';
import { suggestRoomPalettes, suggestedRoomPaletteId } from '../../domain/roomPaletteSuggestions';
import './room-palette.css';

export default function RoomPalettePicker({ atmosphere, value, onChange }: { atmosphere: string; value?: string; onChange: (id: string) => void }) {
  const palettes = suggestRoomPalettes(atmosphere, value);
  const selectedId = suggestedRoomPaletteId(atmosphere, value);
  return <fieldset className="rc-room-palette">
    <legend>おすすめのカラー</legend>
    <p className="rc-room-palette-hint">{palettes.length ? 'イメージに近い色を1つ選んでください。雰囲気を書き直すと候補も変わります。' : '作りたい部屋の雰囲気を文章で教えてください。合う色を4つ提案します。'}</p>
    <div className="rc-room-palette-swatches">
      {palettes.map(palette => {
        const color = roomColor(palette.id) ?? { name: palette.name, color: palette.secondary };
        return <label key={palette.id}>
          <input type="radio" name="room-palette" value={palette.id} checked={selectedId === palette.id} onChange={() => onChange(palette.id)} />
          <span aria-hidden="true" style={{ background: color.color }} />
          {color.name}
        </label>;
      })}
    </div>
  </fieldset>;
}
