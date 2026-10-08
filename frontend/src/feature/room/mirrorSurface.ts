import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { RoomItem } from '../../domain/room';

const reflectingScenes = new WeakSet<THREE.Scene>();

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
  const surface = new Reflector(geometry, {
    color: 0x808080,
    clipBias: .003,
    textureWidth: 512,
    textureHeight: 512,
    multisample: 0,
  });
  surface.name = 'room-mirror-surface';
  surface.userData.roomMirror = true;
  surface.position.set(center.x, center.y, (bounds?.max.z ?? item.size[2] / 2) + .002);
  const renderReflection = surface.onBeforeRender;
  surface.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
    if (scene.overrideMaterial || reflectingScenes.has(scene)) return;
    reflectingScenes.add(scene);
    try { renderReflection.call(this, renderer, scene, camera, geometry, material, group); }
    finally { reflectingScenes.delete(scene); }
  };
  parent.add(surface);
  return surface;
}
