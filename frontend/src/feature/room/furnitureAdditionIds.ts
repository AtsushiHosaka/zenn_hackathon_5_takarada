import type { FurnitureAddition } from '../../domain/room';

// Old saved requests have no UI identity. Assign it once, independently of category/index.
export function identifyFurnitureAdditions(additions: FurnitureAddition[]): FurnitureAddition[] {
  const ids = new Set<string>();
  return additions.map(addition => {
    const uiId = addition.uiId && !ids.has(addition.uiId) ? addition.uiId : crypto.randomUUID();
    ids.add(uiId);
    return {...addition,uiId};
  });
}
