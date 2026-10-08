import { useId } from 'react';
import type { RoomDesign } from '../../domain/room';
import { getFurniturePlacementBounds } from './roomBounds';

export default function RoomFloorPlan({ design }: { design: RoomDesign }) {
  const clipId = useId();
  const bounds = getFurniturePlacementBounds(design);
  const width = bounds.max[0] - bounds.min[0];
  const depth = bounds.max[2] - bounds.min[2];
  const padding = Math.max(width, depth) * 0.07;
  return <figure className="room-list-floor-plan">
    <svg viewBox={`${-padding} ${-padding} ${width + padding * 2} ${depth + padding * 2}`} role="img" aria-label={`${design.title}の平面図`}>
      <defs><clipPath id={clipId}><rect width={width} height={depth}/></clipPath></defs>
      <rect width={width} height={depth} fill={design.room?.floorColor ?? '#d3bda1'} fillOpacity="0.2" stroke="#b9b4c7" strokeWidth={padding * 0.15}/>
      <g clipPath={`url(#${clipId})`}>{design.items.filter(item => item.category !== 'led').map(item => {
        const x = item.position[0] - bounds.min[0];
        const y = item.position[2] - bounds.min[2];
        return <rect key={item.id} x={x - item.size[0] / 2} y={y - item.size[2] / 2} width={item.size[0]} height={item.size[2]} transform={`rotate(${-(item.rotation ?? 0)} ${x} ${y})`} fill={item.color} fillOpacity="0.8" stroke="#16141c" strokeWidth={padding * 0.1}><title>{item.name}</title></rect>;
      })}</g>
    </svg>
    <figcaption>平面図{!design.room && '（推定）'}</figcaption>
  </figure>;
}
