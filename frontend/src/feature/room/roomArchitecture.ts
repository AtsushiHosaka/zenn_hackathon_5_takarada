import * as THREE from "three";
import type { RoomGeometry, RoomWindow } from "../../domain/room";

function solid(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], color: THREE.ColorRepresentation) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: 0.86 }));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function localWindowCenter(window: RoomWindow, length: number) {
  // Backend distances start at the west end for north/south, and the north
  // end for east/west. South/west reverse the wall's inward-facing local X.
  return window.wall === "south" || window.wall === "west"
    ? length / 2 - window.center
    : window.center - length / 2;
}

function addWindow(parent: THREE.Group, window: RoomWindow, center: number) {
  const frame = Math.min(0.045, window.width * 0.06, window.height * 0.06);
  const group = new THREE.Group();
  group.name = `room-window-${window.id}`;
  group.userData.windowId = window.id;
  group.position.set(center, window.bottom + window.height / 2, 0);
  parent.add(group);
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(window.width - frame * 2, window.height - frame * 2),
    new THREE.MeshStandardMaterial({ color: "#bcd8e9", transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, roughness: 0.22 }),
  );
  pane.position.z = 0.015;
  group.add(pane);
  for (const x of [-window.width / 2 + frame / 2, window.width / 2 - frame / 2]) {
    solid(group, [frame, window.height, 0.055], [x, 0, 0.005], "#fafafa");
  }
  for (const y of [-window.height / 2 + frame / 2, window.height / 2 - frame / 2]) {
    solid(group, [window.width - frame * 2, frame, 0.055], [0, y, 0.005], "#fafafa");
  }
}

export function buildMeasuredRoom(scene: THREE.Scene, room: RoomGeometry, wallColor: string, originalFloorColor = room.floorColor) {
  const architecture = new THREE.Group();
  architecture.name = "measured-room";
  scene.add(architecture);
  // Floor surface is exactly Y=0; wall inner faces lie on the supplied bounds.
  const floor = solid(architecture, [room.width, 0.16, room.depth], [0, -0.08, 0], room.floorColor);
  floor.userData.beforeColor = originalFloorColor;
  const rows = Math.min(40, Math.ceil(room.depth / 0.3));
  for (let row = 1; row < rows; row += 1) {
    const color = new THREE.Color(room.floorColor).multiplyScalar(0.9);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-room.width / 2, 0.001, -room.depth / 2 + room.depth * row / rows),
        new THREE.Vector3(room.width / 2, 0.001, -room.depth / 2 + room.depth * row / rows),
      ]),
      new THREE.LineBasicMaterial({ color }),
    );
    line.userData.beforeColor = new THREE.Color(originalFloorColor).multiplyScalar(0.9).getHex();
    architecture.add(line);
  }
  const walls = [
    { wall: "north", length: room.width, position: [0, 0, -room.depth / 2], rotation: 0 },
    { wall: "east", length: room.depth, position: [room.width / 2, 0, 0], rotation: -Math.PI / 2 },
    { wall: "south", length: room.width, position: [0, 0, room.depth / 2], rotation: Math.PI },
    { wall: "west", length: room.depth, position: [-room.width / 2, 0, 0], rotation: Math.PI / 2 },
  ] as const;
  for (const wall of walls) {
    const group = new THREE.Group();
    group.name = `room-wall-${wall.wall}`;
    group.position.set(wall.position[0], wall.position[1], wall.position[2]);
    group.rotation.y = wall.rotation;
    architecture.add(group);
    const windows = room.windows.filter(window => window.wall === wall.wall);
    const openings = windows.map(window => ({
      left: localWindowCenter(window, wall.length) - window.width / 2,
      right: localWindowCenter(window, wall.length) + window.width / 2,
      bottom: window.bottom,
      top: window.bottom + window.height,
    }));
    const xs = [...new Set([-wall.length / 2, wall.length / 2, ...openings.flatMap(window => [
      THREE.MathUtils.clamp(window.left, -wall.length / 2, wall.length / 2),
      THREE.MathUtils.clamp(window.right, -wall.length / 2, wall.length / 2),
    ])])].sort((a, b) => a - b);
    const ys = [...new Set([0, room.height, ...openings.flatMap(window => [
      THREE.MathUtils.clamp(window.bottom, 0, room.height),
      THREE.MathUtils.clamp(window.top, 0, room.height),
    ])])].sort((a, b) => a - b);
    const surface = new THREE.Group();
    surface.userData.cutawayWall = wall.wall;
    group.add(surface);
    for (let column = 0; column < xs.length - 1; column += 1) {
      for (let row = 0; row < ys.length - 1; row += 1) {
        const x = (xs[column] + xs[column + 1]) / 2;
        const y = (ys[row] + ys[row + 1]) / 2;
        if (openings.some(window => x > window.left && x < window.right && y > window.bottom && y < window.top)) continue;
        solid(surface, [xs[column + 1] - xs[column], ys[row + 1] - ys[row], 0.06], [x, y, -0.03], wallColor);
      }
    }
    // Window frames stay at all four physical walls while the nearer wall
    // surfaces fade; transparent panes allow viewing the room through them.
    for (const window of windows) addWindow(group, window, localWindowCenter(window, wall.length));
  }
  return architecture;
}
