import * as THREE from 'three';
import type { RoomItem } from '../../domain/room';

// A complete-room GLB may carry explicit furniture ownership in node extras or
// names. For older models accept spatial ownership only when the whole mesh
// fits one furniture box. Never crop a mesh to a box or guess ambiguous owners.
export function mapCompleteRoomFurniture(model: THREE.Group, items: readonly RoomItem[]) {
  model.updateWorldMatrix(true, true);
  const frames = items.map(item => {
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...item.position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(item.rotation ?? 0)), new THREE.Vector3(1, 1, 1));
    const half = new THREE.Vector3(...item.size).multiplyScalar(.5).addScalar(.003);
    return { item, inverse: transform.invert(), box: new THREE.Box3(half.clone().negate(), half) };
  });
  const aliases = new Map(items.map(item => {
    const clean = (name: string) => name.replace(/[.[\]:/]/g, '_');
    const names = new Set([clean(item.id), clean(item.name)]);
    if (item.modelUrl) {
      try { names.add(clean(decodeURIComponent(new URL(item.modelUrl).pathname.split('/').pop() ?? '').replace(/\.glb$/i, ''))); }
      catch { /* Invalid URLs are handled by the model loader. */ }
    }
    return [item.id, names] as const;
  }));
  const owners = new Map<THREE.Mesh, string>();
  const wholeSubtrees = new Set<string>();
  const trustedOwners = new Set<string>();
  const ambiguous = new Set<string>();
  model.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    let node: THREE.Object3D | null = object;
    while (node && node !== model.parent) {
      const identity = node.userData.itemId ?? node.userData.item_id ?? node.userData.object_id ?? node.name;
      const explicit = items.find(item => item.id === identity);
      if (explicit) {
        owners.set(object, explicit.id);
        trustedOwners.add(explicit.id);
        if (!(node instanceof THREE.Mesh)) wholeSubtrees.add(explicit.id);
        return;
      }
      node = node.parent;
    }
    node = object;
    while (node && node !== model.parent) {
      // Catalog-name/filename aliases are accepted only when unambiguous.
      // They remain partial: an alias alone cannot prove export completeness.
      const named = items.filter(item => aliases.get(item.id)?.has(node!.name));
      if (named.length === 1) { owners.set(object, named[0].id); return; }
      if (named.length > 1) { named.forEach(item => ambiguous.add(item.id)); return; }
      node = node.parent;
    }
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    if (!box || box.isEmpty() || object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh) return;
    const matches = frames.filter(frame => {
      const matrix = new THREE.Matrix4().multiplyMatrices(frame.inverse, object.matrixWorld);
      return frame.box.containsBox(box.clone().applyMatrix4(matrix));
    });
    if (matches.length === 1) owners.set(object, matches[0].item.id);
    else if (matches.length > 1) matches.forEach(frame => ambiguous.add(frame.item.id));
  });
  const groups = new Map<string, THREE.Group>();
  for (const item of items) {
    if ((ambiguous.has(item.id) && !trustedOwners.has(item.id)) || ![...owners.values()].includes(item.id)) continue;
    const group = new THREE.Group();
    group.userData.itemId = item.id;
    model.add(group);
    groups.set(item.id, group);
  }
  const inverse = model.matrixWorld.clone().invert();
  const meshes = [...owners].map(([mesh, id]) => ({ mesh, id, world: mesh.matrixWorld.clone() }));
  for (const { mesh, id, world } of meshes) {
    const group = groups.get(id);
    if (!group) continue;
    // Preserve the exact affine transform, including mirrored/sheared nodes.
    // This model is static; no animation mixer is attached by the viewer.
    mesh.matrix.copy(inverse.clone().multiply(world));
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  model.updateWorldMatrix(true, true);
  return {
    groups,
    unmapped: items.filter(item => !groups.has(item.id)).map(item => item.id),
    // Owning a spatially contained mesh or a tagged leaf cannot prove that all
    // other parts of that furniture were exported under the same owner.
    partial: items.filter(item => groups.has(item.id) && (!wholeSubtrees.has(item.id) || ambiguous.has(item.id))).map(item => item.id),
  };
}
