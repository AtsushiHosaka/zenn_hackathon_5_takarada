import * as THREE from 'three';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import type { RoomItem } from '../../domain/room';

// Reuse one mask/edge buffer per object. Selecting all colliding objects in one
// mask merges their silhouettes and loses each object's hidden full contour.
class WholeObjectOutlinePass extends OutlinePass {
  targets: THREE.Object3D[][] = [];
  override render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget, delta: number, mask: boolean) {
    const autoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try {
      for (const target of this.targets) {
        this.selectedObjects = target;
        super.render(renderer, write, read, delta, mask);
      }
    } finally {
      this.selectedObjects = [];
      renderer.shadowMap.autoUpdate = autoUpdate;
    }
  }
}
export function createFurnitureOutline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  let pipeline: { target: THREE.WebGLRenderTarget; outline: WholeObjectOutlinePass; overlay: THREE.ShaderMaterial; quad: FullScreenQuad } | null = null;
  return {
    render(targets: THREE.Object3D[][]) {
      // Keep the original scene output, including material toneMapped flags and
      // clear color. Only the transparent edge overlay is postprocessed.
      renderer.render(scene, camera);
      if (!targets.length) return;
      if (!pipeline) {
        const size = renderer.getDrawingBufferSize(new THREE.Vector2());
        const target = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: false, stencilBuffer: false });
        const outline = new WholeObjectOutlinePass(size, scene, camera);
        outline.visibleEdgeColor.set('#ff0000');
        outline.hiddenEdgeColor.set('#ff0000');
        outline.edgeStrength = 4;
        outline.edgeThickness = 1;
        outline.edgeGlow = 0;
        outline.pulsePeriod = 0;
        // Alpha is derived only from edges: no mesh fill or rectangular mask.
        outline.overlayMaterial.blending = THREE.NormalBlending;
        outline.overlayMaterial.fragmentShader = `varying vec2 vUv;
          uniform sampler2D maskTexture; uniform sampler2D edgeTexture1; uniform float edgeStrength;
          void main(){vec3 edge=texture2D(edgeTexture1,vUv).rgb;
            float alpha=clamp(edgeStrength*texture2D(maskTexture,vUv).r*max(edge.r,max(edge.g,edge.b)),0.0,1.0);
            gl_FragColor=vec4(1.0,0.0,0.0,alpha);}`;
        const overlay = new THREE.ShaderMaterial({
          uniforms: { edges: { value: target.texture } },
          vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader: `varying vec2 vUv; uniform sampler2D edges; void main(){gl_FragColor=vec4(1.0,0.08,0.08,texture2D(edges,vUv).a);}`,
          transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
        });
        pipeline = { target, outline, overlay, quad: new FullScreenQuad(overlay) };
      }
      const previousTarget = renderer.getRenderTarget();
      const clearColor = renderer.getClearColor(new THREE.Color());
      const clearAlpha = renderer.getClearAlpha();
      const autoClear = renderer.autoClear;
      try {
        renderer.setRenderTarget(pipeline.target);
        renderer.setClearColor(0, 0);
        renderer.clear();
        renderer.setClearColor(clearColor, clearAlpha);
        renderer.autoClear = false;
        pipeline.outline.targets = targets;
        pipeline.outline.render(renderer, pipeline.target, pipeline.target, 0, false);
        renderer.setRenderTarget(previousTarget);
        pipeline.quad.render(renderer);
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(clearColor, clearAlpha);
        renderer.autoClear = autoClear;
      }
    },
    resize(width: number, height: number) {
      const ratio = renderer.getPixelRatio();
      pipeline?.target.setSize(width * ratio, height * ratio);
      pipeline?.outline.setSize(width * ratio, height * ratio);
    },
    dispose() {
      if (!pipeline) return;
      pipeline.outline.targets = [];
      pipeline.outline.dispose(); pipeline.overlay.dispose(); pipeline.quad.dispose(); pipeline.target.dispose();
      pipeline = null;
    },
  };
}

// Complete GLBs contain their furniture already; associate actual meshes using
// node IDs/names, then uniquely contained geometry. Never outline hit boxes.
export function completeFurnitureMeshes(root: THREE.Object3D, items: RoomItem[]): Map<string, THREE.Object3D[]> {
  const result = new Map<string, THREE.Object3D[]>();
  root.updateMatrixWorld(true);
  const names = (item: RoomItem) => {
    const modelName = item.modelUrl ? new URL(item.modelUrl).pathname.split('/').pop()?.replace(/\.glb$/i, '') : undefined;
    return [item.id, THREE.PropertyBinding.sanitizeNodeName(item.id), THREE.PropertyBinding.sanitizeNodeName(item.name), modelName].filter(Boolean);
  };
  const contains = (mesh: THREE.Mesh, item: RoomItem) => {
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (!bounds) return false;
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...item.position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (item.rotation ?? 0) * Math.PI / 180), new THREE.Vector3(1, 1, 1)).invert();
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld).applyMatrix4(transform);
      if (Math.abs(point.x) > item.size[0] / 2 + .005 || Math.abs(point.y) > item.size[1] / 2 + .005 || Math.abs(point.z) > item.size[2] / 2 + .005) return false;
    }
    return true;
  };
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const identified = new Set<string>();
    for (let ancestor: THREE.Object3D | null = object; ancestor && ancestor !== root; ancestor = ancestor.parent) {
      const id = ancestor.userData.itemId ?? ancestor.userData.object_id ?? ancestor.userData.item_id;
      for (const item of items) if ((id !== undefined && id !== null && String(id) === item.id) || names(item).includes(ancestor.name)) identified.add(item.id);
    }
    let candidates = items.filter(item => identified.has(item.id));
    if (candidates.length !== 1) candidates = (candidates.length ? candidates : items).filter(item => contains(object, item));
    if (candidates.length !== 1) return;
    const id = candidates[0].id;
    result.set(id, [...(result.get(id) ?? []), object]);
  });
  return result;
}

// A second phase checks the actual procedural/model parts, avoiding the empty
// space under a desk top and between its legs. Joined GLBs remain conservative.
export function renderedFurnitureBounds(objects: THREE.Object3D[]): THREE.Box3[] {
  const result: THREE.Box3[] = [];
  for (const object of objects) {
    object.updateWorldMatrix(true, true);
    object.traverseVisible(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      if (!materials.some(surface => surface.visible && surface.colorWrite)) return;
      const bounds = new THREE.Box3().setFromObject(child);
      if (!bounds.isEmpty()) result.push(bounds);
    });
  }
  return result;
}
export function furnitureMeshBoundsIntersect(a: THREE.Box3[], b: THREE.Box3[]) {
  const epsilon = 1e-6;
  return a.some(left => b.some(right => (['x', 'y', 'z'] as const).every(axis => left.min[axis] < right.max[axis] - epsilon && left.max[axis] > right.min[axis] + epsilon)));
}
