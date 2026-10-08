import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

// Ported from PR #107 at 57c86fee83c8718e954bcfe851adeac518f79d09.
// Positive extents support mirrored GLBs; separate instances preserve gaps.
const CONTACT_TOLERANCE = 0.003;
export type FurnitureVolume = { bounds: THREE.Box3; meshes: OBB[] };

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

export function renderedFurnitureVolume(objects: THREE.Object3D[]): FurnitureVolume {
  const bounds = new THREE.Box3();
  const meshes: OBB[] = [];
  const visited = new Set<THREE.Mesh>();
  for (const root of objects) {
    root.updateWorldMatrix(true, true);
    root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh) || object.userData.nonPhysical || visited.has(object)) return;
      visited.add(object);
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
  }
  return { bounds, meshes };
}

export function furnitureMeshVolumesIntersect(a: FurnitureVolume, b: FurnitureVolume) {
  return a.bounds.intersectsBox(b.bounds) && a.meshes.some(first => b.meshes.some(second => first.intersectsOBB(second)));
}
