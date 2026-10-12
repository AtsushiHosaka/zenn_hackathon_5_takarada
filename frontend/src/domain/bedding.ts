import type { RoomDesign, RoomItem } from './room';

// Covers are horizontal textiles. Their catalogue length is never a Y height.
// Four centimetres represents a filled cover for the preview, not fabric thickness.
export const BED_COVER_PREVIEW_HEIGHT = 0.04;

export function normalizeBedCover(item: RoomItem): RoomItem {
  if (item.category !== 'bed_cover' || item.size[1] <= 0.12) return item;
  const height = BED_COVER_PREVIEW_HEIGHT;
  return {
    ...item,
    size: [item.size[0], height, item.size[2]],
    // Retain the saved base elevation (usually the mattress surface).
    position: [item.position[0], item.position[1] - item.size[1] / 2 + height / 2, item.position[2]],
    productMetadata: item.productMetadata && {
      ...item.productMetadata,
      size: item.productMetadata.size && { ...item.productMetadata.size, h: null },
      estimatedAxes: [...new Set([...(item.productMetadata.estimatedAxes ?? []), 'h' as const])],
    },
  };
}

export function normalizeRoomBedding(design: RoomDesign): RoomDesign {
  const items = design.items.map(normalizeBedCover);
  const editedItems = design.editedItems?.map(normalizeBedCover);
  const beforeItems = design.before?.items.map(normalizeBedCover);
  if (items.every((item, index) => item === design.items[index])
    && editedItems?.every((item, index) => item === design.editedItems?.[index]) !== false
    && beforeItems?.every((item, index) => item === design.before?.items[index]) !== false) return design;
  return { ...design, items, editedItems, before: design.before && { ...design.before, items: beforeItems! } };
}
