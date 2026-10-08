import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

class FurnitureOutlinePass extends OutlinePass {
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
      }
    } finally {
      this.selectedObjects = objects;
      reflectors.forEach(({ object, callback }) => { object.onBeforeRender = callback; });
    }
  }
}

export function createFurnitureOverlapOutline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  let composer: EffectComposer | undefined;
  let outline: FurnitureOutlinePass | undefined;
  let output: OutputPass | undefined;
  let width = 1, height = 1;
  return {
    render(objects: THREE.Object3D[]) {
      if (!objects.length) { renderer.render(scene, camera); return; }
      if (!composer) {
        const target = new THREE.WebGLRenderTarget(width * renderer.getPixelRatio(), height * renderer.getPixelRatio(), { type: THREE.HalfFloatType });
        target.samples = Math.min(4, renderer.capabilities.maxSamples);
        composer = new EffectComposer(renderer, target);
        composer.addPass(new RenderPass(scene, camera));
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
          }
        `;
        composer.addPass(outline);
        output = new OutputPass();
        composer.addPass(output);
        composer.setSize(width, height);
      }
      outline!.selectedObjects = objects;
      composer.render();
    },
    resize(nextWidth: number, nextHeight: number) {
      width = nextWidth; height = nextHeight;
      composer?.setSize(width, height);
    },
    dispose() {
      outline?.dispose();
      output?.dispose();
      composer?.dispose();
    },
  };
}
