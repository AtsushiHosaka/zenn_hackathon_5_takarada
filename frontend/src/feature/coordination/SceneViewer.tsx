// シーン (部屋 + 置くもの) を three.js で描く。座標系は domain/scene.ts を参照。
// 3D モデル (modelUrl) はまだ読み込まず、すべて size の箱を color で塗って描く。
// suggested には番号マーカーを重ねる (購入リンク一覧の番号と対応)。
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { RoomOutline, Scene, SceneObject, Wall } from "../../domain/scene";

type View = "left" | "standard" | "right" | "top";

const VIEWS: { value: View; label: string }[] = [
  { value: "left", label: "左から" },
  { value: "standard", label: "標準" },
  { value: "right", label: "右から" },
  { value: "top", label: "真上" },
];

const SUGGESTED_EDGE = 0x6b4fb3;
const EXISTING_EDGE = 0x6e6252;

type Stage = { camera: THREE.PerspectiveCamera; controls: OrbitControls; room: RoomOutline };

export default function SceneViewer({ scene }: { scene: Scene }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [view, setView] = useState<View>("standard");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.prepend(renderer.domElement);

    const three = new THREE.Scene();
    three.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a8, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 8, 6);
    three.add(sun);
    three.add(buildRoom(scene.room));

    const markers = scene.objects.map((object) => {
      three.add(buildObject(object));
      return object.source === "suggested" ? createMarker(container, object) : null;
    });

    const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.05, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    stageRef.current = { camera, controls, room: scene.room };
    moveCamera(stageRef.current, "standard");

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = container;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const projected = new THREE.Vector3();
    let frame = 0;
    const loop = () => {
      controls.update();
      renderer.render(three, camera);
      for (const marker of markers) {
        if (!marker) continue;
        projected.copy(marker.anchor).project(camera);
        marker.element.hidden = projected.z > 1;
        marker.element.style.left = `${((projected.x + 1) / 2) * container.clientWidth}px`;
        marker.element.style.top = `${((1 - projected.y) / 2) * container.clientHeight}px`;
      }
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      markers.forEach((marker) => marker?.element.remove());
      three.traverse((node) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
          node.geometry.dispose();
          (node.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      stageRef.current = null;
    };
  }, [scene]);

  const changeView = (next: View) => {
    setView(next);
    if (stageRef.current) moveCamera(stageRef.current, next);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => changeView(option.value)}
            aria-pressed={view === option.value}
            className="rounded px-2 py-1 text-xs text-slate-600 aria-pressed:bg-slate-900 aria-pressed:text-white dark:text-slate-300 dark:aria-pressed:bg-slate-100 dark:aria-pressed:text-slate-900"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-stone-200 dark:bg-stone-800 [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full"
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        ドラッグで回転、ホイールで拡大縮小。3D モデルは未接続のため、家具も商品も箱で描いています。
      </p>
    </div>
  );
}

function moveCamera({ camera, controls, room }: Stage, view: View) {
  const cx = room.width / 2;
  const cz = room.depth / 2;
  const distance = Math.max(room.width, room.depth) * 1.55;
  const positions: Record<View, [number, number, number]> = {
    standard: [cx + distance * 0.55, distance * 0.95, cz + distance * 0.85],
    left: [cx - distance * 0.9, distance * 0.8, cz + distance * 0.55],
    right: [cx + distance, distance * 0.8, cz + distance * 0.15],
    top: [cx, distance * 1.6, cz + 0.001],
  };
  controls.target.set(cx, 0.7, cz);
  camera.position.set(...positions[view]);
  controls.update();
}

function buildRoom(room: RoomOutline): THREE.Group {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(room.width, room.depth),
    new THREE.MeshLambertMaterial({ color: room.floorColor }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.width / 2, 0, room.depth / 2);
  group.add(floor);

  // 壁は内向きの面だけ描く。外から見ると手前の壁が消えて中が見える
  const walls: { wall: Wall; length: number }[] = [
    { wall: "north", length: room.width },
    { wall: "south", length: room.width },
    { wall: "west", length: room.depth },
    { wall: "east", length: room.depth },
  ];
  for (const { wall, length } of walls) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(length, room.height),
      new THREE.MeshLambertMaterial({ color: room.wallColor }),
    );
    const pose = wallPose(room, wall, length / 2, 0);
    mesh.position.set(pose.x, room.height / 2, pose.z);
    mesh.rotation.y = THREE.MathUtils.degToRad(pose.rotation);
    group.add(mesh);
  }

  for (const opening of room.windows) {
    const mesh = box({ w: opening.width, h: opening.height, d: 0.02 }, "#bcd6ea", 0x8fa9bd);
    const pose = wallPose(room, opening.wall, opening.center, 0.012);
    mesh.position.set(pose.x, opening.bottom + opening.height / 2, pose.z);
    mesh.rotation.y = THREE.MathUtils.degToRad(pose.rotation);
    group.add(mesh);
  }
  return group;
}

function buildObject(object: SceneObject): THREE.Mesh {
  const mesh = box(object.size, object.color, object.source === "suggested" ? SUGGESTED_EDGE : EXISTING_EDGE);
  mesh.position.set(object.position.x, object.position.y + object.size.h / 2, object.position.z);
  mesh.rotation.y = THREE.MathUtils.degToRad(object.rotationY);
  return mesh;
}

function box(size: { w: number; h: number; d: number }, color: string, edge: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size.w, size.h, size.d);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: edge })));
  return mesh;
}

// 壁に沿った位置 along と壁面からの距離 offset から、位置と向き (部屋の内側を向く) を返す
function wallPose(room: RoomOutline, wall: Wall, along: number, offset: number) {
  switch (wall) {
    case "north":
      return { x: along, z: offset, rotation: 0 };
    case "south":
      return { x: along, z: room.depth - offset, rotation: 180 };
    case "west":
      return { x: offset, z: along, rotation: 90 };
    case "east":
      return { x: room.width - offset, z: along, rotation: 270 };
  }
}

function createMarker(container: HTMLElement, object: SceneObject) {
  const element = document.createElement("div");
  element.textContent = String(object.marker);
  element.className =
    "pointer-events-none absolute -ml-[11px] -mt-[11px] grid size-[22px] place-items-center rounded-full border-2 border-white bg-violet-700 text-[11px] font-medium text-white shadow";
  container.append(element);
  const anchor = new THREE.Vector3(
    object.position.x,
    object.position.y + object.size.h + 0.08,
    object.position.z,
  );
  return { element, anchor };
}
