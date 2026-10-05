import * as THREE from "three";
import type { MaterialOverrides } from "../../domain/room";

/** GLBの1UV=1mを、contain表示の等方スケールに合わせて補正する。 */
export function applyMaterialOverrides(
  root: THREE.Object3D,
  overrides: MaterialOverrides,
  modelScale: number,
  onFailure: () => void,
): () => void {
  const loader = new THREE.TextureLoader();
  const textures = new Set<THREE.Texture>();
  let disposed = false;
  let applied = 0;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const replace = (material: THREE.Material) => {
      const next = material.clone();
      for (const [key, value] of Object.entries(next)) {
        if (!(value instanceof THREE.Texture)) continue;
        const copy = value.clone();
        copy.userData.sharedImage = true;
        Object.assign(next, { [key]: copy });
        textures.add(copy);
      }
      const override = Object.hasOwn(overrides, material.name) ? overrides[material.name] : undefined;
      if (!override || !(next instanceof THREE.MeshStandardMaterial)) return next;
      applied++;
      if (override.textureUrl) {
        // 成功するまで元の単色を維持する。失敗した画像をmapに残さない。
        next.map = null;
        const texture = loader.load(override.textureUrl, loaded => {
          if (disposed) { loaded.dispose(); return; }
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.wrapS = THREE.RepeatWrapping;
          loaded.wrapT = THREE.RepeatWrapping;
          const repeat = modelScale / (override.tileSizeM ?? 0.5);
          loaded.repeat.set(repeat, repeat);
          loaded.anisotropy = 4;
          // glTFのUV方向に合わせる。
          loaded.flipY = false;
          next.map = loaded;
          next.color.set(override.color ?? "#ffffff");
          next.needsUpdate = true;
        }, undefined, () => {
          texture.dispose();
          textures.delete(texture);
          if (disposed) return;
          next.map = null;
          next.needsUpdate = true;
          onFailure();
        });
        textures.add(texture);
      } else if (override.color !== undefined) {
        next.map = null;
        next.color.set(override.color);
      }
      next.needsUpdate = true;
      return next;
    };
    object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
  });
  // 元の素材・画像は破棄しない。別の商品やBeforeが参照していても変更しない。
  if (!applied && Object.keys(overrides).length) onFailure();
  return () => {
    disposed = true;
    textures.forEach(texture => texture.dispose());
    textures.clear();
  };
}
