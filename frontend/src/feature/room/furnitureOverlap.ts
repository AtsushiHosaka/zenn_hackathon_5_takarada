import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import type { RoomDesign, RoomItem } from '../../domain/room';
import { furnitureSurfaceHeight } from './roomBounds';

// Ignore contact and sub-3mm placement/mesh rounding. Use each visible mesh's
// bounding volume, preserving the empty space between separate table/chair legs.
const CONTACT_TOLERANCE = 0.003;
const adornments = new Set(['cover', 'bed_cover', 'rug', 'wall_decor', 'artwork', 'led', 'poster']);
const supportedContact = (item: RoomItem, support: RoomItem, design: RoomDesign) =>
  item.supportObjectId === support.id && furnitureSurfaceHeight(item, item.position, design) !== null;
type FurnitureVolume = { id: string; bounds: THREE.Box3; meshes: OBB[] };

function meshVolume(mesh: THREE.Mesh, matrix: THREE.Matrix4): { bounds: THREE.Box3; obb: OBB } | undefined {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const local = mesh.geometry.boundingBox;
  if (!local || local.isEmpty()) return;
  const bounds = local.clone().applyMatrix4(matrix);
  const basis = [0, 1, 2].map(axis => new THREE.Vector3().setFromMatrixColumn(matrix, axis));
  if (basis.some(axis => axis.lengthSq() < 1e-12)) return;
  const scales = basis.map(axis => axis.length());
  basis.forEach(axis => axis.normalize());
  const sheared = Math.abs(basis[0].dot(basis[1])) > 1e-5 || Math.abs(basis[0].dot(basis[2])) > 1e-5 || Math.abs(basis[1].dot(basis[2])) > 1e-5;
  const obb = new OBB().fromBox3(sheared ? bounds : local);
  if (!sheared) {
    // Build positive extents explicitly: OBB.applyMatrix4 gives negative extents
    // for mirrored GLB nodes and does not fully transform a local box center.
    obb.center.copy(local.getCenter(new THREE.Vector3()).applyMatrix4(matrix));
    obb.halfSize.multiply(new THREE.Vector3(...scales));
    obb.rotation.set(
      basis[0].x, basis[1].x, basis[2].x,
      basis[0].y, basis[1].y, basis[2].y,
      basis[0].z, basis[1].z, basis[2].z,
    );
  }
  obb.halfSize.subScalar(CONTACT_TOLERANCE / 2);
  if (Math.min(obb.halfSize.x, obb.halfSize.y, obb.halfSize.z) <= 0) return;
  return { bounds, obb };
}

function furnitureVolume(id: string, group: THREE.Group): FurnitureVolume {
  const bounds = new THREE.Box3();
  const meshes: OBB[] = [];
  group.updateWorldMatrix(true, true);
  group.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.nonPhysical) return;
    const surfaces = Array.isArray(object.material) ? object.material : [object.material];
    if (!surfaces.some(surface => surface.visible && surface.opacity > 0 && surface.colorWrite)) return;
    const add = (matrix: THREE.Matrix4) => {
      const volume = meshVolume(object, matrix);
      if (volume) { bounds.union(volume.bounds); meshes.push(volume.obb); }
    };
    if (object instanceof THREE.InstancedMesh) {
      const instance = new THREE.Matrix4();
      for (let index = 0; index < object.count; index++) {
        object.getMatrixAt(index, instance);
        add(new THREE.Matrix4().multiplyMatrices(object.matrixWorld, instance));
      }
    } else add(object.matrixWorld);
  });
  return { id, bounds, meshes };
}

export function findFurnitureOverlaps(groups: ReadonlyMap<string, THREE.Group>, design?: RoomDesign): Set<string> {
  const items = new Map(design?.items.map(item => [item.id, item]) ?? []);
  const volumes = [...groups].filter(([id, group]) => group.visible && !adornments.has(items.get(id)?.category ?? '')).map(([id, group]) => furnitureVolume(id, group));
  const overlaps = new Set<string>();
  for (let index = 0; index < volumes.length; index++) {
    const left = volumes[index];
    for (const right of volumes.slice(index + 1)) {
      const firstItem = items.get(left.id), secondItem = items.get(right.id);
      if (design && firstItem && secondItem && (supportedContact(firstItem, secondItem, design) || supportedContact(secondItem, firstItem, design))) continue;
      if (!left.bounds.intersectsBox(right.bounds)) continue;
      if (left.meshes.some(first => right.meshes.some(second => first.intersectsOBB(second)))) {
        overlaps.add(left.id);
        overlaps.add(right.id);
      }
    }
  }
  return overlaps;
}
