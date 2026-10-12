import * as THREE from 'three';

type Wall = 'north' | 'east' | 'south' | 'west';
const HIDDEN_OPACITY = 0.12;
const FADE_DURATION_MS = 280;
const SIDE_THRESHOLD = 0.3;
const SIDE_HYSTERESIS = 0.08;

/** Cache wall materials once; animate them inside the viewer's existing loop. */
export function createWallCutaway(architecture: THREE.Object3D) {
  const walls: {
    wall: Wall;
    surfaces: { material: THREE.Material; opacity: number; transparent: boolean; depthWrite: boolean }[];
    nearSide: boolean | null;
    opacity: number;
    from: number;
    startedAt: number;
  }[] = [];
  architecture.traverse(object => {
    const wall: Wall | undefined = object.userData.cutawayWall
      ?? (object.name === 'cutaway-left-wall' ? 'west' : object.name === 'cutaway-back-wall' ? 'north' : undefined);
    if (!wall) return;
    const materials = new Set<THREE.Material>();
    object.traverse(child => {
      if (child instanceof THREE.Mesh) {
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
      }
    });
    walls.push({
      wall,
      surfaces: [...materials].map(material => ({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite })),
      nearSide: null, opacity: 1, from: 1, startedAt: 0,
    });
  });

  return (camera: THREE.Vector3, center: THREE.Vector3, now: number, reducedMotion: boolean) => {
    let changed = false;
    let transitioning = false;
    for (const state of walls) {
      const side = state.wall === 'west' ? center.x - camera.x
        : state.wall === 'east' ? camera.x - center.x
          : state.wall === 'north' ? center.z - camera.z : camera.z - center.z;
      // A small dead band prevents repeated reversals near the camera-side boundary.
      const threshold = SIDE_THRESHOLD + (state.nearSide === null ? 0 : state.nearSide ? -SIDE_HYSTERESIS : SIDE_HYSTERESIS);
      const nearSide = side > threshold;
      const target = nearSide ? HIDDEN_OPACITY : 1;
      const initial = state.nearSide === null;
      if (initial || nearSide !== state.nearSide) {
        state.from = state.opacity;
        state.startedAt = now;
        state.nearSide = nearSide;
      }
      const progress = initial || reducedMotion ? 1 : THREE.MathUtils.clamp((now - state.startedAt) / FADE_DURATION_MS, 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const opacity = THREE.MathUtils.lerp(state.from, target, eased);
      transitioning ||= opacity !== target;
      if (!initial && opacity === state.opacity) continue;
      state.opacity = opacity;
      changed = true;
      for (const surface of state.surfaces) {
        const { material } = surface;
        const faded = opacity < 1;
        const transparent = faded || surface.transparent;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.opacity = surface.opacity * opacity;
        // A fading wall must not occlude artwork in the depth buffer. Once
        // solid, restore physical occlusion and the original material settings.
        material.depthWrite = faded ? false : surface.depthWrite;
      }
    }
    return { changed, transitioning };
  };
}
