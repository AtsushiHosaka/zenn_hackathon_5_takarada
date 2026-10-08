import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
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
export function completeFurnitureMeshes(root: THREE.Object3D, items: RoomItem[]) {
  const meshes = new Map<string, THREE.Object3D[]>();
  const wholeSubtrees = new Set<string>();
  const ambiguous = new Set<string>();
  root.updateMatrixWorld(true);
  const names = (item: RoomItem) => {
    const modelName = item.modelUrl ? new URL(item.modelUrl).pathname.split('/').pop()?.replace(/\.glb$/i, '') : undefined;
    return [THREE.PropertyBinding.sanitizeNodeName(item.name), modelName].filter(Boolean);
  };
  const contains = (mesh: THREE.Mesh, item: RoomItem) => {
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (!bounds || mesh instanceof THREE.InstancedMesh || mesh instanceof THREE.SkinnedMesh) return false;
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...item.position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (item.rotation ?? 0) * Math.PI / 180), new THREE.Vector3(1, 1, 1)).invert();
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld).applyMatrix4(transform);
      if (Math.abs(point.x) > item.size[0] / 2 + .005 || Math.abs(point.y) > item.size[1] / 2 + .005 || Math.abs(point.z) > item.size[2] / 2 + .005) return false;
    }
    return true;
  };
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const explicit = new Set<string>();
    const identified = new Set<string>();
    for (let ancestor: THREE.Object3D | null = object; ancestor && ancestor !== root; ancestor = ancestor.parent) {
      const identity = ancestor.userData.itemId ?? ancestor.userData.object_id ?? ancestor.userData.item_id;
      for (const item of items) {
        if ((identity !== undefined && identity !== null && String(identity) === item.id) || [item.id, THREE.PropertyBinding.sanitizeNodeName(item.id)].includes(ancestor.name)) {
          explicit.add(item.id);
          if (!(ancestor instanceof THREE.Mesh)) wholeSubtrees.add(item.id);
        } else if (names(item).includes(ancestor.name)) identified.add(item.id);
      }
    }
    let candidates = items.filter(item => (explicit.size ? explicit : identified).has(item.id));
    if (candidates.length !== 1) candidates = (candidates.length ? candidates : items).filter(item => contains(object, item));
    if (candidates.length !== 1) { candidates.forEach(item => ambiguous.add(item.id)); return; }
    const id = candidates[0].id;
    meshes.set(id, [...(meshes.get(id) ?? []), object]);
  });
  return { meshes, unmapped: items.filter(item => !meshes.has(item.id)).map(item => item.id),
    partial: items.filter(item => meshes.has(item.id) && (!wholeSubtrees.has(item.id) || ambiguous.has(item.id))).map(item => item.id) };
}

// Actual leaf mesh volumes preserve leg gaps and rotated/reflected transforms.
const CONTACT_TOLERANCE = .003;
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

export function renderedFurnitureVolumes(objects: THREE.Object3D[]): OBB[] {
  const result: OBB[] = [];
  const visited = new Set<THREE.Mesh>();
  for (const object of objects) {
    object.updateWorldMatrix(true, true);
    object.traverseVisible(child => {
      if (!(child instanceof THREE.Mesh) || visited.has(child)) return;
      visited.add(child);
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      if (!materials.some(surface => surface.visible && surface.opacity > 0 && surface.colorWrite)) return;
      const add = (matrix: THREE.Matrix4) => { const volume = meshVolume(child, matrix); if (volume) result.push(volume.obb); };
      if (child instanceof THREE.InstancedMesh) {
        const instance = new THREE.Matrix4();
        for (let index = 0; index < child.count; index++) { child.getMatrixAt(index, instance); add(new THREE.Matrix4().multiplyMatrices(child.matrixWorld, instance)); }
      } else add(child.matrixWorld);
    });
  }
  return result;
}
export function furnitureMeshVolumesIntersect(a: OBB[], b: OBB[]) {
  return a.some(left => b.some(right => left.intersectsOBB(right)));
}
