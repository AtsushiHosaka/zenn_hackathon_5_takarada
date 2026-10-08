import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export function createMirrorSurface(width: number, height: number, geometry?: THREE.BufferGeometry): Reflector {
  const mirror = new Reflector(geometry ?? new THREE.PlaneGeometry(width, height), {
    // Reflector uses an overlay blend; linear 0.5 preserves reflected colors.
    color: new THREE.Color().setRGB(.5, .5, .5), clipBias: .003, textureWidth: 256, textureHeight: 256, multisample: 0,
  });
  const reflect = mirror.onBeforeRender;
  // Reflector renders the scene synchronously. Hide all reflective surfaces and
  // editor overlays for that pass, so multiple mirrors cannot recurse.
  mirror.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
    // Composer depth/mask passes must not overwrite the color reflection.
    if (scene.overrideMaterial) return;
    const target = renderer.getRenderTarget();
    const xrEnabled = renderer.xr.enabled;
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const hidden: THREE.Object3D[] = [];
    scene.traverse(object => {
      if (object.visible && (object instanceof Reflector || object instanceof THREE.Sprite || object instanceof THREE.BoxHelper || object.userData.reflectionExcluded)) {
        hidden.push(object);
        object.visible = false;
      }
    });
    try { reflect.call(this, renderer, scene, camera, geometry, material, group); }
    finally {
      for (const object of hidden) object.visible = true;
      renderer.xr.enabled = xrEnabled;
      renderer.shadowMap.autoUpdate = shadowAutoUpdate;
      if (renderer.getRenderTarget() !== target) renderer.setRenderTarget(target);
    }
  };
  return mirror;
}

export function resizeMirrorSurfaces(scene: THREE.Object3D, renderer: THREE.WebGLRenderer): void {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // Preserve viewport aspect while bounding each target to 512px per axis.
  const scale = Math.min(1, 512 / Math.max(size.x, size.y));
  const width = Math.max(1, Math.round(size.x * scale));
  const height = Math.max(1, Math.round(size.y * scale));
  scene.traverse(object => {
    if (!(object instanceof Reflector)) return;
    const target = object.getRenderTarget();
    if (target.width !== width || target.height !== height) target.setSize(width, height);
  });
}
