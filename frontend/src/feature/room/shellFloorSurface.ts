import * as THREE from 'three';
import type { RoomGeometry } from '../../domain/room';

const FLOOR_TOLERANCE = .03;
const BOUND_TOLERANCE = .005;
const MIN_FLOOR_COVERAGE = .5;
const MAX_FLOOR_COVERAGE = 1.05;

// Shells contain architecture in the room's coordinates. Match actual upward
// floor triangles, including a floor combined with walls in one mesh; never
// recolor the source model's shared materials or infer surfaces from their names.
export function createShellFloorOverlay(model: THREE.Object3D, room: RoomGeometry, color: string): THREE.Mesh | null {
  const vertices: number[] = [];
  let area = 0;
  model.updateWorldMatrix(true, true);
  model.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh) return;
    const geometry = object.geometry;
    const positions = geometry.getAttribute('position');
    if (!positions) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const index = geometry.getIndex();
    const count = index?.count ?? positions.count;
    const start = Math.max(0, geometry.drawRange.start);
    const end = Math.min(count, start + geometry.drawRange.count);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
    for (let offset = start; offset + 2 < end; offset += 3) {
      const materialIndex = geometry.groups.find(group => offset >= group.start && offset < group.start + group.count)?.materialIndex ?? 0;
      const material = materials[materialIndex];
      if (!material?.visible || material.opacity <= 0 || !material.colorWrite) continue;
      const local = [0, 1, 2].map(vertex => new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(offset + vertex) : offset + vertex));
      const normal = new THREE.Vector3().subVectors(local[1], local[0]).cross(new THREE.Vector3().subVectors(local[2], local[0])).applyNormalMatrix(normalMatrix);
      if (normal.y < .995) continue;
      const points = local.map(point => point.applyMatrix4(object.matrixWorld));
      if (points.some(point => !Number.isFinite(point.x + point.y + point.z)
        || Math.abs(point.y) > FLOOR_TOLERANCE
        || Math.abs(point.x) > room.width / 2 + BOUND_TOLERANCE
        || Math.abs(point.z) > room.depth / 2 + BOUND_TOLERANCE)) continue;
      const triangleArea = new THREE.Vector3().subVectors(points[1], points[0]).cross(new THREE.Vector3().subVectors(points[2], points[0])).length() / 2;
      if (triangleArea < 1e-8) continue;
      // Reflected root transforms can reverse winding even when the physical
      // surface normal still points up. Keep the overlay front face upward.
      if (new THREE.Vector3().subVectors(points[1], points[0]).cross(new THREE.Vector3().subVectors(points[2], points[0])).y < 0) [points[1], points[2]] = [points[2], points[1]];
      area += triangleArea;
      for (const point of points) vertices.push(point.x, point.y + .001, point.z);
    }
  });
  const roomArea = room.width * room.depth;
  if (!Number.isFinite(area) || area < roomArea * MIN_FLOOR_COVERAGE || area > roomArea * MAX_FLOOR_COVERAGE) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const overlay = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .86, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  overlay.name = 'edited-shell-floor';
  overlay.receiveShadow = true;
  overlay.renderOrder = 1;
  return overlay;
}
