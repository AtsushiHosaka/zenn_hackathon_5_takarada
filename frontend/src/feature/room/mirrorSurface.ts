import * as THREE from 'three';
import type { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { createMirrorSurface } from './mirrorReflection';
import type { RoomItem } from '../../domain/room';

export function isMirrorCategory(category: string) {
  return category === 'wall_mirror' || category === 'mirror';
}

// Reflectors use a reflected camera and an oblique clip plane. Keep auxiliary
// outline/depth renders and mirrors facing each other from recursively rendering.
export function addMirrorSurface(parent: THREE.Group, item: RoomItem, bounds?: THREE.Box3): Reflector {
  const width = bounds ? bounds.max.x - bounds.min.x : item.size[0];
  const height = bounds ? bounds.max.y - bounds.min.y : item.size[1];
  const center = bounds?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3(0, height / 2, 0);
  const shape = item.productMetadata?.shape ?? '';
  const geometry = /round|circular|circle|oval|ellipse|円|丸/i.test(shape)
    ? new THREE.CircleGeometry(.5, 64).scale(width * .92, height * .94, 1)
    : new THREE.PlaneGeometry(width * .92, height * .94);
  const surface = createMirrorSurface(width, height, geometry);
  surface.name = 'room-mirror-surface';
  surface.userData.roomMirror = true;
  surface.position.set(center.x, center.y, (bounds?.max.z ?? item.size[2] / 2) + .002);
  parent.add(surface);
  return surface;
}
