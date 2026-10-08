import type { RoomDesign, RoomItem } from '../../domain/room';
import { furniturePositionInRoom, getFurniturePlacementBounds } from './roomBounds';

export function productReplacementPosition(product: RoomItem, item: RoomItem, design: RoomDesign): RoomItem['position'] | undefined {
  const floorCategory = ['sofa', 'bed', 'desk', 'chair', 'shelf', 'table', 'rug', 'floor_lamp', 'plant', 'display_case'].includes(product.category);
  const bounds = getFurniturePlacementBounds(design);
  const floor = item.position[1] - item.size[1] / 2;
  const position: RoomItem['position'] = [item.position[0], floorCategory ? product.size[1] / 2 + bounds.floor : floor + product.size[1] / 2, item.position[2]];
  const fitted = furniturePositionInRoom({ ...product, rotation: item.rotation }, position, design);
  if (!fitted || position[1] - product.size[1] / 2 < bounds.floor - 1e-9 || position[1] + product.size[1] / 2 > bounds.max[1] + 1e-9) return undefined;
  return [fitted[0], position[1], fitted[2]];
}

