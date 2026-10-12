import * as THREE from 'three';
import type { RoomItem } from '../../domain/room';

/** A closed, softly filled textile with tapered seams and small surface folds. */
export function createBedCoverModel(item: RoomItem): THREE.Mesh {
  const [width, height, depth] = item.size;
  const geometry = new THREE.BoxGeometry(width, height, depth, 28, 1, 40);
  const vertices = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < vertices.count; index++) {
    const x = vertices.getX(index), y = vertices.getY(index), z = vertices.getZ(index);
    const u = x / (width / 2), v = z / (depth / 2);
    const fullness = Math.pow(Math.max(0, (1 - u * u) * (1 - v * v)), 0.55);
    const fold = Math.sin(u * 13 + v * 4) * Math.sin(v * 11) * fullness;
    const halfThickness = height / 2 * (0.08 + 0.92 * fullness);
    vertices.setXYZ(index,
      x * (1 - 0.025 * (1 - v * v)),
      height / 2 + Math.sign(y) * halfThickness + height * 0.06 * fold,
      z * (1 - 0.012 * (1 - u * u)));
    // Override texture repeats are expressed in metres, like catalogue GLBs.
    uv.setXY(index, x + width / 2, z + depth / 2);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.96 });
  material.name = 'tint';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'bed-cover-cloth';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
