import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

class FurnitureOutlinePass extends OutlinePass {
  private readonly overlay = new FullScreenQuad(this.overlayMaterial);

  override dispose() { this.overlay.dispose(); super.dispose(); }
  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    const objects = this.selectedObjects;
    const reflectors: { object: THREE.Object3D; callback: THREE.Object3D['onBeforeRender'] }[] = [];
    this.renderScene.traverse(object => {
      if (!(object as THREE.Object3D & { isReflector?: boolean }).isReflector) return;
      reflectors.push({ object, callback: object.onBeforeRender });
      // Auxiliary depth/mask renders must not refresh a mirror's color texture.
      object.onBeforeRender = () => {};
    });
    try {
      // An aggregate mask hides boundaries between overlapping objects. Draw
      // each whole furniture group separately, including its occluded edges.
      for (const object of objects) {
        this.selectedObjects = [object];
        super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
        // Composite only the alpha boundary onto the already-rendered scene.
        // Reprocessing the base scene changes clear colors and toneMapped=false
        // artwork/markers, so leave its color pipeline completely untouched.
        renderer.setRenderTarget(null);
        const autoClear = renderer.autoClear;
        renderer.autoClear = false;
        try { this.overlay.render(renderer); }
        finally { renderer.autoClear = autoClear; }
      }
    } finally {
      this.selectedObjects = objects;
      reflectors.forEach(({ object, callback }) => { object.onBeforeRender = callback; });
    }
  }
}

export function createFurnitureOverlapOutline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  let outline: FurnitureOutlinePass | undefined;
  // OutlinePass writes its discarded composite here while producing its masks.
  const scratch = new THREE.WebGLRenderTarget(1, 1);
  let width = 1, height = 1;
  return {
    render(objects: THREE.Object3D[]) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      if (!objects.length) return;
      if (!outline) {
        outline = new FurnitureOutlinePass(new THREE.Vector2(width, height), scene, camera);
        outline.visibleEdgeColor.set('white');
        outline.hiddenEdgeColor.set('white');
        outline.edgeStrength = 5;
        outline.edgeThickness = 1.5;
        outline.edgeGlow = 0;
        outline.downSampleRatio = 1;
        // Alpha covers only the thin boundary. Normal blending keeps the line
        // red on light furniture without tinting the furniture's surfaces.
        outline.overlayMaterial.blending = THREE.NormalBlending;
        outline.overlayMaterial.toneMapped = false;
        outline.overlayMaterial.uniforms.outlineColor = { value: new THREE.Color('#ed2638') };
        outline.overlayMaterial.fragmentShader = `
          varying vec2 vUv;
          uniform sampler2D edgeTexture1;
          uniform sampler2D maskTexture;
          uniform float edgeStrength;
          uniform vec3 outlineColor;
          void main() {
            float edge = texture2D(edgeTexture1, vUv).r;
            float outside = texture2D(maskTexture, vUv).r;
            gl_FragColor = vec4(outlineColor, clamp(edge * edgeStrength * outside, 0.0, 1.0));
            #include <colorspace_fragment>
          }
        `;
        outline.setSize(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
      }
      outline.selectedObjects = objects;
      outline.render(renderer, scratch, scratch, 0, false);
    },
    resize(nextWidth: number, nextHeight: number) {
      width = nextWidth; height = nextHeight;
      outline?.setSize(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
    },
    dispose() {
      outline?.dispose();
      scratch.dispose();
    },
  };
}
