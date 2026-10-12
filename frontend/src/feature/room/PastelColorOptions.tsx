import './pastel-color-options.css';

const pastelColors = [
  ['#BFE3F5', '水色'], ['#FFFFFF', '白'], ['#CDE8D1', '緑'],
  ['#F3C5C5', '赤'], ['#FFF0B3', '黄色'],
] as const;

export default function PastelColorOptions({ target, value, onChange }: { target: string; value: string; onChange: (color: string) => void }) {
  const custom = !pastelColors.some(([color]) => color.toLowerCase() === value.toLowerCase());
  return <div className="rc-pastel-options" role="group" aria-label={`${target}の色を選ぶ`}>
    {pastelColors.map(([color, name]) => <button type="button" className="motion-control" key={color}
      aria-label={`${target}を${name}にする`} aria-pressed={color.toLowerCase() === value.toLowerCase()} onClick={() => onChange(color)}>
      <span className="rc-pastel-chip" style={{ backgroundColor: color }} aria-hidden="true"/>{name}
    </button>)}
    <label className={`rc-pastel-custom${custom ? ' is-selected' : ''}`}>
      <input type="color" aria-label={`${target}の色をカラーピッカーで選ぶ`} value={value} onChange={event => onChange(event.target.value)}/>
      <span>自由に選ぶ</span>
    </label>
  </div>;
}
