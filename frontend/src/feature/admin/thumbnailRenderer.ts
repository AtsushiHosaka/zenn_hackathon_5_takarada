import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { FurnitureSize } from "../../domain/furnitureAdmin";
import type { MaterialOverrides } from "../../domain/room";
import { applyMaterialOverrides } from "../room/furnitureMaterials";

export type ThumbnailRequest = { modelUrl: string; size: FurnitureSize; colors: Record<string, string> };

const PIXELS = 160;
// 斜め上から見る向き。ModelPreview の初期位置と同じ
const VIEW_DIRECTION = new THREE.Vector3(1.5, 0.9, 2.1).normalize();

type Stage = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera };
let stage: Stage | null = null;
// 一覧の行ごとに WebGL を作るとブラウザの上限 (十数個) を超えるので、1 つを使い回して 1 件ずつ描く
let queue: Promise<unknown> = Promise.resolve();

function sharedStage(): Stage {
  if (stage) return stage;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(PIXELS, PIXELS, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b4c8, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  stage = { renderer, scene, camera: new THREE.PerspectiveCamera(30, 1, 0.01, 100) };
  return stage;
}

async function draw({ modelUrl, size, colors }: ThumbnailRequest): Promise<string> {
  const { renderer, scene, camera } = sharedStage();
  const root = (await new GLTFLoader().loadAsync(modelUrl)).scene;
  const bounds = new THREE.Box3().setFromObject(root);
  const modelSize = bounds.getSize(new THREE.Vector3());
  if (Math.min(modelSize.x, modelSize.y, modelSize.z) <= 0) throw new Error("empty model");
  // 部屋の画面と同じく、商品の寸法に収まるよう等倍で拡縮する
  const scale = Math.min(size.w / modelSize.x, size.h / modelSize.y, size.d / modelSize.z);
  const center = bounds.getCenter(new THREE.Vector3());
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  const overrides: MaterialOverrides = Object.fromEntries(
    Object.entries(colors).filter(([, color]) => /^#[0-9a-f]{6}$/i.test(color)).map(([key, color]) => [key, { color }]),
  );
  const cleanup = Object.keys(overrides).length ? applyMaterialOverrides(root, overrides, scale, () => {}) : null;
  scene.add(root);
  try {
    const shown = new THREE.Box3().setFromObject(root);
    const sphere = shown.getBoundingSphere(new THREE.Sphere());
    const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
    camera.position.copy(sphere.center).addScaledVector(VIEW_DIRECTION, distance);
    camera.near = distance / 100;
    camera.far = distance * 10;
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    // 描いた直後に読む (次のフレームでは消えている)
    return renderer.domElement.toDataURL("image/png");
  } finally {
    scene.remove(root);
    cleanup?.();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
  }
}

/** 3D モデルを商品の寸法・色で描いた小さな画像 (data URL) を返す。保存はせず、その場で作る */
export function renderModelThumbnail(request: ThumbnailRequest): Promise<string> {
  const result = queue.then(() => draw(request));
  queue = result.catch(() => {});
  return result;
}
