import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { FurnitureSize } from "../../domain/furnitureAdmin";
import type { MaterialOverrides } from "../../domain/room";
import { applyMaterialOverrides } from "../room/furnitureMaterials";

type Appearance = { size: FurnitureSize; colors: Record<string, string>; fallbackColor: string };
type Stage = { apply: () => void };

function disposeMaterials(material: THREE.Material | THREE.Material[]) {
  for (const entry of Array.isArray(material) ? material : [material]) entry.dispose();
}

/**
 * 商品 1 つの見た目を 3D で確かめる。部屋の画面と同じく、モデルを商品の寸法に収まるよう等倍で拡縮し、部位ごとの色を塗る。
 * 枠線は商品の寸法。モデルの URL が無いときは代表色の箱を出す。ドラッグで回転、ホイールで拡大縮小。
 */
export default function ModelPreview({ modelUrl, size, colors, fallbackColor }: { modelUrl: string | null } & Appearance) {
  const container = useRef<HTMLDivElement>(null);
  const notice = useRef<HTMLParagraphElement>(null);
  const appearance = useRef<Appearance>({ size, colors, fallbackColor });
  const stage = useRef<Stage | null>(null);
  const colorKey = JSON.stringify(colors);

  // 色・寸法の変更はモデルを読み直さずに塗り直す (カメラの向きも保つ)
  useEffect(() => {
    appearance.current = { size, colors, fallbackColor };
    stage.current?.apply();
    // colors は colorKey で比べる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, size.d, colorKey, fallbackColor]);

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      if (notice.current) { notice.current.textContent = "このブラウザでは3D表示を使えません"; notice.current.hidden = false; }
      return;
    }
    let disposed = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b4c8, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    // 動かしたときだけ描く。毎フレーム描き続けると一覧の操作まで重くなる
    let frameRequest = 0;
    const render = () => {
      if (frameRequest || disposed) return;
      frameRequest = requestAnimationFrame(() => { frameRequest = 0; renderer.render(scene, camera); });
    };
    controls.addEventListener("change", render);

    const frame = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8b7fd1 }));
    scene.add(frame);
    const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    scene.add(placeholder);

    let root: THREE.Object3D | null = null;
    let modelBounds: THREE.Box3 | null = null;
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    let cleanupOverrides: (() => void) | null = null;
    let framed = false;

    const restoreMaterials = () => {
      cleanupOverrides?.();
      cleanupOverrides = null;
      for (const [mesh, original] of originals) {
        if (mesh.material === original) continue;
        disposeMaterials(mesh.material);
        mesh.material = original;
      }
    };

    const apply = () => {
      const { size: current, colors: currentColors, fallbackColor: fallback } = appearance.current;
      if (![current.w, current.h, current.d].every((value) => Number.isFinite(value) && value > 0)) return;
      frame.geometry.dispose();
      frame.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(current.w, current.h, current.d));
      frame.position.set(0, current.h / 2, 0);
      placeholder.visible = !root;
      placeholder.scale.set(current.w, current.h, current.d);
      placeholder.position.set(0, current.h / 2, 0);
      if (/^#[0-9a-f]{6}$/i.test(fallback)) placeholder.material.color.set(fallback);
      if (root && modelBounds) {
        const modelSize = modelBounds.getSize(new THREE.Vector3());
        const center = modelBounds.getCenter(new THREE.Vector3());
        const scale = Math.min(current.w / modelSize.x, current.h / modelSize.y, current.d / modelSize.z);
        root.scale.setScalar(scale);
        root.position.set(-center.x * scale, -modelBounds.min.y * scale, -center.z * scale);
        restoreMaterials();
        const overrides: MaterialOverrides = Object.fromEntries(
          Object.entries(currentColors).filter(([, color]) => /^#[0-9a-f]{6}$/i.test(color)).map(([key, color]) => [key, { color }]),
        );
        if (Object.keys(overrides).length) cleanupOverrides = applyMaterialOverrides(root, overrides, scale, () => {});
      }
      if (!framed) {
        const reach = Math.max(current.w, current.h, current.d);
        controls.target.set(0, current.h / 2, 0);
        camera.position.set(reach * 1.5, current.h / 2 + reach * 0.9, reach * 2.1);
        camera.near = reach / 100;
        camera.far = reach * 100;
        camera.updateProjectionMatrix();
        controls.update();
        framed = true;
      }
      render();
    };
    stage.current = { apply };
    apply();

    if (notice.current) { notice.current.hidden = Boolean(modelUrl); notice.current.textContent = "3Dモデルの配信元が未設定のため、箱で表示しています"; }
    if (modelUrl) {
      new GLTFLoader().load(modelUrl, (gltf) => {
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const loadedSize = bounds.getSize(new THREE.Vector3());
        if (disposed || Math.min(loadedSize.x, loadedSize.y, loadedSize.z) <= 0) return;
        root = gltf.scene;
        modelBounds = bounds;
        root.traverse((object) => { if (object instanceof THREE.Mesh) originals.set(object, object.material); });
        scene.add(root);
        apply();
      }, undefined, () => {
        if (disposed || !notice.current) return;
        notice.current.textContent = "3Dモデルを読み込めませんでした";
        notice.current.hidden = false;
      });
    }

    const resize = () => {
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    return () => {
      disposed = true;
      stage.current = null;
      observer.disconnect();
      cancelAnimationFrame(frameRequest);
      controls.dispose();
      restoreMaterials();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
        object.geometry.dispose();
        disposeMaterials(object.material);
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelUrl]);

  return <div className="relative h-64 overflow-hidden rounded-lg border border-[#E4E1EC] bg-gradient-to-b from-white to-[#ECE9F5]">
    <div ref={container} className="h-full w-full [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full" aria-label="3Dでの見た目" role="img" />
    <p ref={notice} hidden className="absolute inset-x-2 bottom-2 rounded bg-white/90 px-2 py-1 text-xs text-slate-600" />
  </div>;
}
