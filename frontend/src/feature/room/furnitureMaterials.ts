import * as THREE from "three";

/**
 * GCSで配信する家具GLBの素材を、素材名を指定して後から張り替える。
 * 色を変える部分は "tint"。ほかに "wood" / "metal" / "leaf" / "pot" / "trim" / "light" などがある
 * (モデルごとの一覧は家具モデルAPIの materials)。
 * GLB の UV は 1 = 1m の箱投影なので、繰り返しテクスチャはどのモデルにも同じ実寸で張られる。
 */
export type MaterialOverride = {
  /** 基本色。テクスチャと併用すると乗算になる (テクスチャだけなら白のまま) */
  color?: THREE.ColorRepresentation;
  /** 繰り返しテクスチャ (柄・木目・織り目など) の URL */
  textureUrl?: string;
  /** テクスチャ1枚が覆う実寸 (m)。既定 0.5m */
  tileSize?: number;
};

export type MaterialOverrides = Record<string, MaterialOverride>;

const loader = new THREE.TextureLoader();
type Source = { texture: THREE.Texture; loaded: boolean; copies: Set<THREE.Texture> };
const sources = new Map<string, Source>();

function loadTexture(url: string, tileSize: number): THREE.Texture {
  let source = sources.get(url);
  if (!source) {
    const entry: Source = { texture: new THREE.Texture(), loaded: false, copies: new Set() };
    entry.texture = loader.load(url, () => {
      entry.loaded = true;
      for (const copy of entry.copies) copy.needsUpdate = true;
      entry.copies.clear();
    });
    entry.texture.colorSpace = THREE.SRGBColorSpace;
    sources.set(url, entry);
    source = entry;
  }
  // 画像は共有し、繰り返し設定と破棄は素材ごとに持つ
  const texture = source.texture.clone();
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / tileSize, 1 / tileSize);
  texture.anisotropy = 4;
  if (source.loaded) texture.needsUpdate = true;
  else source.copies.add(texture);
  return texture;
}

/** root 以下で名前が一致する素材を複製して上書きする。同じGLBを共有するほかの家具には影響しない。 */
export function applyMaterialOverrides(root: THREE.Object3D, overrides: MaterialOverrides) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const replace = (material: THREE.Material) => {
      const override = overrides[material.name];
      if (!override || !(material instanceof THREE.MeshStandardMaterial)) return material;
      const next = material.clone();
      if (override.textureUrl) {
        next.map = loadTexture(override.textureUrl, override.tileSize ?? 0.5);
        next.color.set(override.color ?? "#ffffff");
      } else if (override.color !== undefined) {
        next.map = null;
        next.color.set(override.color);
      }
      next.needsUpdate = true;
      return next;
    };
    object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
  });
}
