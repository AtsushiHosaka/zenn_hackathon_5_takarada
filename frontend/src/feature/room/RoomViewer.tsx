import { roomPalette } from "../../domain/roomPalette";
import { characterTheme } from "../../domain/characterTheme";
import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { isManualFurniture, type RoomDesign, type RoomItem } from "../../domain/room";
import { buildReferenceRoom, usesReferenceRoom } from "./referenceRoomModel";
import { buildCharacterThemeDecor } from "./characterThemeDecor";
import { buildMeasuredRoom } from "./roomArchitecture";
import { LAYOUT_GRID_STEP, snapItemPosition } from "./layoutGrid";
import { applyMaterialOverrides } from "./furnitureMaterials";
import { getFurniturePlacementBounds, snapFurnitureEditPosition } from './roomBounds';

interface RoomViewerProps {
  design: RoomDesign;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  view: "perspective" | "top" | "front";
  dimensions?: boolean;
  editing?: boolean;
  onMoveItem?: (id: string, position: RoomItem["position"]) => void;
  placementItem?: RoomItem | null;
  onPlaceItem?: (position: RoomItem["position"]) => void;
  resetKey: number;
  before?: boolean;
  preview?: boolean;
  onReady?: (ready: boolean) => void;
  command?: { sequence: number; action: "left" | "right" | "in" | "out" };
}

type ViewerRuntime = {
  select: (id: string | null) => void;
  setView: (view: RoomViewerProps["view"]) => void;
  reset: () => void;
  setBefore: (before: boolean, markersVisible: boolean) => void;
  setEditing: (editing: boolean) => void;
  setPlacement: (item: RoomItem | null) => void;
  command: (command: NonNullable<RoomViewerProps["command"]>) => void;
};

function material(color: THREE.ColorRepresentation, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function createItemMarker(item: RoomItem) {
  if (item.marker === undefined) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 144;
  canvas.height = 144;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.beginPath();
  context.arc(72, 72, 59, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = "#6a3cd6";
  context.stroke();
  const label = String(item.marker);
  context.fillStyle = "#6a3cd6";
  context.font = `700 ${label.length > 2 ? 40 : label.length > 1 ? 54 : 64}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 72, 75);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  sprite.scale.set(0.2, 0.2, 1);
  sprite.renderOrder = 30;
  sprite.userData.itemId = item.id;
  return sprite;
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: THREE.ColorRepresentation,
  rounded = false,
) {
  const geometry = rounded
    ? new RoundedBoxGeometry(...size, 3, Math.min(...size) * 0.16)
    : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  position: [number, number, number],
  color: THREE.ColorRepresentation,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 32), material(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function stem(parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
  const delta = to.clone().sub(from);
  const mesh = cylinder(parent, radius, radius, delta.length(), [0, 0, 0], "#486145");
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
}

function plant(parent: THREE.Object3D, width: number, height: number, potColor: string) {
  const potHeight = height * 0.27;
  cylinder(parent, width * 0.32, width * 0.23, potHeight, [0, potHeight / 2, 0], potColor);
  cylinder(parent, width * 0.3, width * 0.3, 0.025, [0, potHeight + 0.007, 0], "#4b4033");
  for (let i = 0; i < 13; i += 1) {
    const angle = i * 2.399;
    const leafHeight = potHeight + height * (0.32 + (i % 5) * 0.092);
    const spread = width * (0.15 + (i % 3) * 0.07);
    const end = new THREE.Vector3(Math.cos(angle) * spread, leafHeight, Math.sin(angle) * spread);
    stem(parent, new THREE.Vector3(0, potHeight, 0), end, width * 0.009);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material(i % 3 ? "#507958" : "#76976a"));
    leaf.scale.set(width * 0.13, height * 0.18, width * 0.034);
    leaf.position.copy(end);
    leaf.rotation.set(Math.sin(angle) * 0.7, -angle, Math.cos(angle) * -0.6);
    leaf.castShadow = true;
    parent.add(leaf);
  }
}

function createFurniture(item: RoomItem, accent: string, oshi: boolean, manager?: THREE.LoadingManager) {
  const group = new THREE.Group();
  group.userData.itemId = item.id;
  const [w, h, d] = item.size;
  const wood = "#b99069";
  const paleWood = "#d3ba96";
  const dark = "#605747";
  const color = item.color;
  switch (item.category) {
    case "poster":
    case "acrylic_stand": {
      const stand = item.category === "acrylic_stand";
      const baseHeight = stand ? Math.min(.015, h * .08) : 0;
      if (stand) {
        const base = box(group, [w, baseHeight, d], [0, baseHeight / 2, 0], "#e4eff5", true);
        const surface = base.material as THREE.MeshStandardMaterial;
        surface.transparent = true; surface.opacity = .65; surface.roughness = .2;
      } else box(group, [w, h, d], [0, h / 2, 0], color);
      if (item.artwork) {
        const texture = new THREE.TextureLoader(manager).load(item.artwork.dataUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        const art = new THREE.Mesh(new THREE.PlaneGeometry(stand ? w : w * .96, stand ? h - baseHeight : h * .96), new THREE.MeshBasicMaterial({
          map: texture, transparent: true, alphaTest: stand ? .1 : 0, side: THREE.DoubleSide, toneMapped: false,
        }));
        art.position.set(0, (h + baseHeight) / 2, stand ? 0 : d / 2 + .0005);
        group.add(art);
      }
      break;
    }
    case "sofa": {
      for (const x of [-w * 0.4, w * 0.4]) {
        for (const z of [-d * 0.33, d * 0.33]) {
          cylinder(group, 0.045, 0.035, h * 0.22, [x, h * 0.11, z], wood);
        }
      }
      box(group, [w, h * 0.26, d], [0, h * 0.3, 0], color, true);
      box(group, [w, h * 0.63, d * 0.22], [0, h * 0.66, -d * 0.4], color, true);
      for (const x of [-w * 0.46, w * 0.46]) {
        box(group, [w * 0.1, h * 0.5, d], [x, h * 0.51, 0], color, true);
      }
      for (const x of [-w * 0.23, w * 0.23]) {
        box(group, [w * 0.42, h * 0.13, d * 0.7], [x, h * 0.46, d * 0.05], color, true);
      }
      const cushion = box(group, [w * 0.22, h * 0.42, d * 0.15], [-w * 0.25, h * 0.7, -d * 0.14], accent, true);
      cushion.userData.afterAccent = true;
      cushion.rotation.z = 0.12;
      const cushion2 = box(group, [w * 0.2, h * 0.37, d * 0.17], [w * 0.28, h * 0.68, -d * 0.14], "#e7dec8", true);
      cushion2.rotation.z = -0.16;
      break;
    }
    case "rug": {
      if (oshi) {
        const rug = cylinder(group, 0.5, 0.5, Math.max(h, 0.035), [0, h / 2, 0], color);
        rug.scale.set(w, 1, d);
        const innerColor = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.18);
        const inner = cylinder(group, 0.46, 0.46, 0.004, [0, h + 0.003, 0], innerColor);
        inner.scale.set(w, 1, d);
        break;
      }
      box(group, [w, Math.max(h, 0.035), d], [0, 0.025, 0], color, true);
      for (let i = -4; i <= 4; i += 1) {
        box(group, [w * 0.91, 0.004, 0.012], [0, 0.025 + Math.max(h, 0.035) / 2, i * d * 0.09], "#d5cbb9");
      }
      break;
    }
    case "table": {
      cylinder(group, Math.min(w, d) / 2, Math.min(w, d) / 2, h * 0.12, [0, h * 0.94, 0], color);
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        cylinder(group, 0.045, 0.055, h * 0.88, [Math.cos(a) * w * 0.26, h * 0.44, Math.sin(a) * d * 0.26], wood);
      }
      box(group, [w * 0.28, 0.035, d * 0.26], [w * 0.1, h + 0.018, 0], "#e6dac9");
      box(group, [w * 0.25, 0.025, d * 0.23], [w * 0.1, h + 0.047, 0], accent);
      cylinder(group, 0.055, 0.047, 0.075, [-w * 0.23, h + 0.038, 0.07], "#f6f1e5");
      break;
    }
    case "plant":
      plant(group, Math.min(w, d), h, color);
      break;
    case "display":
    case "shelf": {
      if (oshi) {
        for (let tier = 0; tier < 3; tier += 1) {
          const tierHeight = h * (tier + 1) * 0.25;
          const z = d / 2 - d * (tier + 0.5) / 3;
          box(group, [w, tierHeight, d / 3], [0, tierHeight / 2, z], color, true);
          for (let figure = 0; figure < 3; figure += 1) {
            const x = w * (figure - 1) * 0.27;
            const figureColor = ["#b49cf0", "#7d5ce6", "#d9cbff"][(figure + tier) % 3];
            cylinder(group, w * 0.055, w * 0.055, 0.018, [x, tierHeight + 0.009, z], "#eee8ff");
            box(group, [w * 0.095, h * 0.14, 0.016], [x, tierHeight + h * 0.09, z], figureColor, true);
            const head = new THREE.Mesh(new THREE.SphereGeometry(w * 0.042, 12, 8), material("#efddcf"));
            head.position.set(x, tierHeight + h * 0.185, z);
            head.scale.z = 0.28;
            head.castShadow = true;
            group.add(head);
          }
        }
        break;
      }
      for (const x of [-w * 0.47, w * 0.47]) {
        box(group, [w * 0.055, h, d], [x, h / 2, 0], color);
      }
      box(group, [w, h * 0.97, 0.025], [0, h * 0.49, -d * 0.48], paleWood);
      for (let tier = 0; tier < 4; tier += 1) {
        const y = 0.08 + tier * (h - 0.12) / 3;
        box(group, [w, 0.045, d], [0, y, 0], color);
        if (tier < 3) {
          for (let book = 0; book < 4; book += 1) {
            box(group, [w * 0.065, h * (0.16 + (book % 2) * 0.025), d * 0.63], [-w * 0.34 + book * w * 0.075, y + h * 0.1, 0.02], [accent, "#c8b48f", "#ece2d1", "#8c9d88"][book]);
          }
          cylinder(group, w * 0.09, w * 0.1, h * 0.16, [w * 0.25, y + h * 0.08, 0], "#f0e8da");
        } else {
          const tabletopPlant = new THREE.Group();
          tabletopPlant.position.set(w * 0.25, y + 0.025, 0);
          plant(tabletopPlant, w * 0.27, h * 0.26, "#bb9477");
          group.add(tabletopPlant);
        }
      }
      break;
    }
    case "light":
    case "lamp": {
      cylinder(group, w * 0.35, w * 0.4, 0.045, [0, 0.025, 0], dark);
      cylinder(group, 0.018, 0.018, h * 0.79, [0, h * 0.4, 0], dark);
      cylinder(group, w * 0.26, w * 0.5, h * 0.23, [0, h * 0.87, 0], color);
      const light = new THREE.PointLight("#ffdeaa", 0.6, 2.5);
      light.position.set(0, h * 0.78, 0);
      group.add(light);
      break;
    }
    case "bed": {
      box(group, [w, h * 0.37, d], [0, h * 0.24, 0], wood, true);
      box(group, [w * 0.97, h * 0.27, d * 0.97], [0, h * 0.53, 0], "#f2ecdf", true);
      box(group, [w, h, 0.12], [0, h / 2, -d / 2], paleWood, true);
      const blanket = box(group, [w * 0.99, h * 0.04, d * 0.64], [0, h * 0.69, d * 0.17], oshi ? "#b8a3e6" : color, true);
      blanket.userData.afterAccent = true;
      for (const x of [-w * 0.25, w * 0.25]) {
        box(group, [w * 0.39, h * 0.15, d * 0.19], [x, h * 0.72, -d * 0.33], "#eee7d8", true);
      }
      break;
    }
    case "desk": {
      box(group, [w, h * 0.07, d], [0, h * 0.95, 0], color, true);
      for (const x of [-w * 0.44, w * 0.44]) {
        box(group, [w * 0.065, h * 0.9, d * 0.83], [x, h * 0.45, 0], wood);
      }
      box(group, [w * 0.36, h * 0.34, 0.045], [w * 0.1, h * 1.27, -d * 0.22], "#3e3c4a", true);
      box(group, [w * 0.31, h * 0.28, 0.005], [w * 0.1, h * 1.27, -d * 0.22 + 0.027], "#595366");
      cylinder(group, 0.025, 0.025, h * 0.12, [w * 0.1, h * 1.06, -d * 0.22], "#33323d");
      box(group, [w * 0.13, 0.02, d * 0.19], [w * 0.1, h * 0.998, -d * 0.22], "#33323d");
      box(group, [w * 0.3, 0.025, d * 0.21], [-w * 0.08, h * 1.003, d * 0.19], "#e9e7ee", true);
      break;
    }
    case "chair": {
      cylinder(group, w * 0.38, w * 0.38, 0.04, [0, 0.025, 0], "#33323d");
      cylinder(group, 0.025, 0.025, h * 0.48, [0, h * 0.25, 0], "#33323d");
      box(group, [w, h * 0.1, d], [0, h * 0.51, 0], color, true);
      box(group, [w, h * 0.46, d * 0.13], [0, h * 0.78, -d * 0.44], color, true);
      break;
    }
    case "led": {
      const strip = box(group, [w, h, d], [0, h / 2, 0], color);
      (strip.material as THREE.MeshStandardMaterial).emissive.set(color);
      (strip.material as THREE.MeshStandardMaterial).emissiveIntensity = 2;
      break;
    }
    case "wall_decor":
    case "artwork": {
      box(group, [w, h, d], [0, h / 2, 0], wood);
      box(group, [w * 0.9, h * 0.91, d * 0.24], [0, h / 2, d * 0.6], "#f0ebde");
      const motif = new THREE.Mesh(new THREE.CircleGeometry(w * 0.23, 32), material(color));
      motif.position.set(w * 0.1, h * 0.6, d * 0.74);
      group.add(motif);
      box(group, [w * 0.45, h * 0.38, d * 0.05], [-w * 0.12, h * 0.29, d * 0.76], "#c6a489");
      break;
    }
    default:
      box(group, [w, h, d], [0, h / 2, 0], color, true);
  }
  // Decorative primitives stay inside the declared outer dimensions, including
  // desk monitors, pillows, plant leaves, and bed headboards.
  const bounds = new THREE.Box3().setFromObject(group);
  const builtSize = bounds.getSize(new THREE.Vector3());
  const builtCenter = bounds.getCenter(new THREE.Vector3());
  const scale = new THREE.Vector3(w / builtSize.x, h / builtSize.y, d / builtSize.z);
  for (const child of group.children) {
    child.position.sub(new THREE.Vector3(builtCenter.x, bounds.min.y, builtCenter.z));
  }
  group.scale.copy(scale);
  group.position.set(...item.position);
  // Domain positions describe the center; primitive furniture is built up from its base.
  group.position.y -= h / 2;
  group.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
  return group;
}

function fittedDistance(bounds: THREE.Box3, target: THREE.Vector3, direction: THREE.Vector3, aspect: number, fov: number) {
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const horizontalTangent = verticalTangent * aspect;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new THREE.Vector3(x, y, z).sub(target);
        const depth = offset.dot(direction);
        distance = Math.max(distance, depth + Math.abs(offset.dot(up)) / verticalTangent, depth + Math.abs(offset.dot(right)) / horizontalTangent);
      }
    }
  }
  return distance * 1.1;
}

function buildRoom(scene: THREE.Scene, accent: string, bounds: THREE.Box3, oshi: boolean, wallColor?: string) {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const width = size.x;
  const depth = size.z;
  const height = size.y - 0.18;
  const left = -width / 2 + 0.065;
  const back = -depth / 2 + 0.065;
  const architecture = new THREE.Group();
  architecture.position.set(center.x, bounds.min.y + 0.18, center.z);
  scene.add(architecture);
  const podium = cylinder(architecture, 0.5, 0.5, 0.08, [0, -0.25, 0], "#29253a");
  podium.scale.set(width * 1.48, 1, depth * 1.48);
  box(architecture, [width, 0.16, depth], [0, -0.1, 0], "#ac8866");
  const rows = Math.min(40, Math.ceil(depth / 0.3));
  const columns = Math.min(20, Math.ceil(width / 1.65));
  const plankWidth = width / columns;
  const plankDepth = depth / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const colors = ["#d9bf99", "#d4b58c", "#dfc8a6", "#d8ba92"];
      box(architecture, [plankWidth - 0.008, 0.025, plankDepth - 0.008], [-width / 2 + plankWidth * (column + 0.5), -0.009, -depth / 2 + plankDepth * (row + 0.5)], colors[(row + column) % 4]);
    }
  }
  const leftWall = box(architecture, [0.13, height, depth], [left, height / 2, 0], wallColor ?? (oshi ? "#d4c8ea" : "#eeeade"));
  const backWall = box(architecture, [width, height, 0.13], [0, height / 2, back], wallColor ?? (oshi ? "#e5ddf3" : "#f5f1e8"));
  leftWall.userData.beforeColor = "#dcd6cd";
  backWall.userData.beforeColor = "#ebe6df";
  leftWall.name = "cutaway-left-wall";
  backWall.name = "cutaway-back-wall";
  box(architecture, [0.15, 0.11, depth], [left + 0.085, 0.075, 0], "#dfd6c3");
  box(architecture, [width - 0.2, 0.11, 0.15], [0, 0.075, back + 0.09], "#dfd6c3");
  if (oshi) {
    const led = new THREE.Group();
    led.userData.afterAccent = true;
    architecture.add(led);
    const strips = [
      box(led, [0.025, 0.035, depth - 0.2], [left + 0.08, height - 0.16, 0], "#e2d6ff"),
      box(led, [width - 0.2, 0.035, 0.025], [0, height - 0.16, back + 0.08], "#e2d6ff"),
    ];
    for (const strip of strips) {
      const surface = strip.material as THREE.MeshStandardMaterial;
      surface.emissive.set("#a982ff");
      surface.emissiveIntensity = 2.5;
      strip.castShadow = false;
    }
    const glow = new THREE.PointLight("#a982ff", 1.2, Math.max(width, depth));
    glow.position.set(0, height - 0.3, back + 0.35);
    led.add(glow);
  }
  // A luminous window and mullions provide a familiar sense of room scale.
  const windowX = width * 0.12;
  const windowY = Math.min(height - 0.93, 1.71);
  box(architecture, [2.15, 1.55, 0.09], [windowX, windowY, back + 0.12], "#d9e7df");
  const glazing = box(architecture, [2.02, 1.42, 0.02], [windowX, windowY, back + 0.18], "#e7f1ed");
  (glazing.material as THREE.MeshStandardMaterial).emissive.set("#cbded3");
  (glazing.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25;
  for (const x of [windowX - 1.06, windowX, windowX + 1.06]) {
    box(architecture, [0.055, 1.55, 0.12], [x, windowY, back + 0.23], "#faf7ed");
  }
  for (const y of [windowY - 0.75, windowY, windowY + 0.75]) {
    box(architecture, [2.17, 0.055, 0.12], [windowX, y, back + 0.23], "#faf7ed");
  }
  box(architecture, [2.3, 0.075, 0.31], [windowX, windowY - 0.77, back + 0.25], "#c7ac87");
  for (const x of [windowX - 1.36, windowX + 1.36]) {
    for (let fold = 0; fold < 5; fold += 1) {
      const curtain = cylinder(architecture, 0.045, 0.045, 1.87, [x + fold * 0.055, windowY - 0.19, back + 0.33], oshi ? "#b8a3e6" : "#e2dfcf");
      curtain.userData.beforeColor = "#d8d1c6";
    }
  }
  const art = new THREE.Group();
  art.userData.afterAccent = true;
  art.position.set(left + 0.095, 1.75, -depth * 0.16);
  art.rotation.y = Math.PI / 2;
  box(art, [0.88, 1.15, 0.05], [0, 0, 0], "#a98a68");
  box(art, [0.77, 1.04, 0.025], [0, 0, 0.033], "#ede8d9");
  const artCircle = new THREE.Mesh(new THREE.CircleGeometry(0.25, 40), material(accent));
  artCircle.position.set(0.06, 0.11, 0.051);
  art.add(artCircle);
  box(art, [0.4, 0.47, 0.01], [-0.12, -0.25, 0.06], "#bc987c");
  architecture.add(art);
  const daylight = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.1), new THREE.MeshBasicMaterial({ color: "#fff8da", transparent: true, opacity: 0.15, depthWrite: false }));
  daylight.rotation.x = -Math.PI / 2;
  daylight.rotation.z = -0.35;
  daylight.position.set(windowX + 0.15, 0.009, back + 1.77);
  architecture.add(daylight);
  return architecture;
}

function createLayoutGrid(bounds: THREE.Box3, floor: number) {
  const grid = new THREE.Group();
  grid.name = "layout-grid";
  const minor: number[] = [];
  const major: number[] = [];
  for (const axis of ["x", "z"] as const) {
    const first = Math.ceil(bounds.min[axis] / LAYOUT_GRID_STEP);
    const last = Math.floor(bounds.max[axis] / LAYOUT_GRID_STEP);
    for (let cell = first; cell <= last; cell++) {
      const value = cell / 10;
      const vertices = cell % 5 === 0 ? major : minor;
      if (axis === "x") vertices.push(value, floor + 0.006, bounds.min.z, value, floor + 0.006, bounds.max.z);
      else vertices.push(bounds.min.x, floor + 0.006, value, bounds.max.x, floor + 0.006, value);
    }
  }
  for (const [vertices, opacity] of [[minor, 0.24], [major, 0.46]] as const) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    grid.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: "#766195", transparent: true, opacity, depthWrite: false, toneMapped: false })));
  }
  return grid;
}

function disposeObject(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Sprite)) return;
    if (!(child instanceof THREE.Sprite)) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
      mat.dispose();
    }
  });
  for (const texture of textures) {
    texture.dispose();
    if (!texture.userData.sharedImage && typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close();
  }
}

export function RoomViewer({ design: afterDesign, selectedItemId, onSelectItem, view, resetKey, before = false, command, dimensions = false, editing = false, onMoveItem, placementItem = null, onPlaceItem, preview = false, onReady }: RoomViewerProps) {
  const design = useMemo<RoomDesign>(() => before && afterDesign.before ? {
    ...afterDesign,
    room: afterDesign.before.room,
    items: afterDesign.before.items,
    wallColor: afterDesign.before.wallColor,
    characterThemeId: undefined,
    roomPaletteId: undefined,
    style: afterDesign.characterThemeId ? "natural" : afterDesign.style,
    modelUrl: undefined,
    modelKind: undefined,
  } : afterDesign, [afterDesign, before]);
  // A supplied Before snapshot is a separate scene, including removed original
  // furniture. Legacy designs still use the existing visibility-only comparison.
  const legacyBefore = before && !afterDesign.before;
  const canvasHost = useRef<HTMLDivElement>(null);
  const fallback = useRef<HTMLDivElement>(null);
  const modelNotice = useRef<HTMLDivElement>(null);
  const textureNotice = useRef<HTMLDivElement>(null);
  const runtime = useRef<ViewerRuntime | null>(null);
  const roomBounds = useRef<{ id: string; bounds: THREE.Box3 } | null>(null);
  const cameraState = useRef<{ id: string; position: THREE.Vector3; target: THREE.Vector3; zoom: number; view: RoomViewerProps["view"]; lastCommandSequence: number | null } | null>(null);
  const reportReady = useEffectEvent((ready: boolean) => onReady?.(ready));
  const selectItem = useEffectEvent(onSelectItem);
  const moveItem = useEffectEvent((id: string, position: RoomItem["position"]) => onMoveItem?.(id, position));
  const placeItem = useEffectEvent((position: RoomItem["position"]) => onPlaceItem?.(position));
  const initialView = useEffectEvent(() => view);
  const initialBefore = useEffectEvent(() => legacyBefore);
  const initialMarkersVisible = useEffectEvent(() => !before && !preview);
  const initialEditing = useEffectEvent(() => editing && Boolean(onMoveItem) && !before);
  const initialPlacement = useEffectEvent(() => !before && onPlaceItem ? placementItem : null);
  const dimensionItem = dimensions ? design.items.find(item => item.id === selectedItemId) : undefined;
  const viewDescription = view === "top" ? "真上からの表示。" : view === "front" ? "正面からの表示。" : "立体表示。";
  const instructions = preview ? `${design.title}の保存した3Dモデル。` : `部屋の3Dプレビュー。${before ? "変更前の部屋。" : ""}${viewDescription}`;

  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      if (fallback.current) fallback.current.hidden = false;
      reportReady(false);
      return;
    }
    if (fallback.current) fallback.current.hidden = true;
    if (modelNotice.current) modelNotice.current.hidden = true;
    if (textureNotice.current) textureNotice.current.hidden = true;
    let disposed = false;
    let assetsReady = true;
    let assetFailed = false;
    let readySent = false;
    let previewNeedsRender = true;
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onStart = () => { assetsReady = false; };
    loadingManager.onLoad = () => { assetsReady = true; previewNeedsRender = true; };
    loadingManager.onError = () => { assetFailed = true; if (!disposed && textureNotice.current) textureNotice.current.hidden = false; };
    const previewDeadline = window.setTimeout(() => {
      if (!disposed && !readySent) { readySent = true; reportReady(false); }
    }, 20000);
    const textureCleanups: (() => void)[] = [];
    const scene = new THREE.Scene();
    const themedDecor = buildCharacterThemeDecor(design);
    if (themedDecor) scene.add(themedDecor);
    const reference = !design.room && usesReferenceRoom(design);
    const aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
    const referenceHeight = 410 / (50 * Math.sqrt(1.5));
    const camera = reference ? new THREE.OrthographicCamera(-referenceHeight * aspect / 2, referenceHeight * aspect / 2, referenceHeight / 2, -referenceHeight / 2, .1, 80) : new THREE.PerspectiveCamera(36, aspect, .1, 80);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x16141c, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = reference ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-label", "部屋の3Dプレビュー");
    renderer.domElement.setAttribute("role", "img");
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    if (preview) {
      controls.enableZoom = false;
      controls.enablePan = false;
      renderer.domElement.style.touchAction = "pan-y";
    }
    controls.maxPolarAngle = Math.PI / 2 - 0.035;
    const hemi = new THREE.HemisphereLight("#faf5ff", "#a99abb", 2.2);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff2dc", 3.4);
    sun.position.set(1.5, 7.5, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0001;
    scene.add(sun);
    scene.add(sun.target);
    const theme = characterTheme(design.characterThemeId);
    const oshi = design.style === "oshi" && !theme;
    const accent = roomPalette(design.roomPaletteId)?.accent ?? theme?.accent ?? (oshi ? "#bba5ee" : design.style === "natural" ? "#c2a07f" : "#819274");
    if (design.room) {
      roomBounds.current = {
        id: design.id,
        bounds: new THREE.Box3(
          new THREE.Vector3(-design.room.width / 2, -0.16, -design.room.depth / 2),
          new THREE.Vector3(design.room.width / 2, design.room.height, design.room.depth / 2),
        ),
      };
    } else if (design.inferredRoomBounds || roomBounds.current?.id !== design.id) {
      const inferred = getFurniturePlacementBounds(design);
      roomBounds.current = { id: design.id, bounds: new THREE.Box3(new THREE.Vector3(...inferred.min), new THREE.Vector3(...inferred.max)) };
    }
    const baseRoomBounds = roomBounds.current.bounds.clone();
    const cameraBounds = baseRoomBounds.clone();
    const savedCamera = cameraState.current?.id === design.id ? cameraState.current : null;
    const referenceRoom = reference ? buildReferenceRoom(scene, design) : null;
    const architecture = design.room
      ? buildMeasuredRoom(scene, design.room, design.wallColor ?? "#f5f1e8")
      : referenceRoom?.architecture ?? buildRoom(scene, accent, baseRoomBounds, oshi, design.wallColor);
    if (referenceRoom) cameraBounds.copy(referenceRoom.bounds);
    let proceduralRoomVisible = true;
    let currentBefore = initialBefore();
    let markersVisible = initialMarkersVisible();
    let currentEditing = initialEditing();
    let cancelDrag = () => {};
    let clearPlacementPreview = () => {};
    let currentPlacement = initialPlacement();
    let loadedRoom: THREE.Group | null = null;
    const completeRoomModel = Boolean(design.modelUrl) && design.modelKind !== "shell";
    const gridBounds = referenceRoom?.floorBounds ?? baseRoomBounds;
    const gridFloor = design.room || referenceRoom ? 0 : getFurniturePlacementBounds(design).floor;
    const layoutGrid = createLayoutGrid(gridBounds, gridFloor);
    layoutGrid.visible = currentEditing && !currentBefore && !completeRoomModel;
    scene.add(layoutGrid);
    const cutawayWalls: { object: THREE.Object3D; wall: "north" | "east" | "south" | "west" }[] = [];
    architecture.traverse(object => {
      if (object.userData.cutawayWall) cutawayWalls.push({ object, wall: object.userData.cutawayWall });
      else if (object.name === "cutaway-left-wall") cutawayWalls.push({ object, wall: "west" });
      else if (object.name === "cutaway-back-wall") cutawayWalls.push({ object, wall: "north" });
    });
    for (const { object } of cutawayWalls) {
      object.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        for (const surface of Array.isArray(child.material) ? child.material : [child.material]) surface.transparent = true;
      });
    }
    const furniture = referenceRoom?.furniture ?? new Map<string, THREE.Group>();
    const hitTargets = new Map<string, THREE.Group>();
    const markers = new Map<string, THREE.Sprite>();
    const existingIds = new Set(design.items.filter(item => item.existing).map(item => item.id));
    for (const item of design.items) {
      if (reference && !isManualFurniture(item)) continue;
      // The reference drawing only contains its fixed original furniture. New
      // owned furniture uses the same editable primitives as measured rooms.
      const previous = furniture.get(item.id);
      if (previous) { scene.remove(previous); disposeObject(previous); }
      const group = createFurniture(item, accent, oshi, loadingManager);
      scene.add(group);
      furniture.set(item.id, group);
    }
    for (const item of design.items) {
      const marker = createItemMarker(item);
      if (!marker) continue;
      markers.set(item.id, marker);
      scene.add(marker);
    }
    let selection: THREE.BoxHelper | null = null;
    let selectedId: string | null = null;
    const updateSelection = (id: string | null) => {
      selectedId = id;
      if (selection) {
        scene.remove(selection);
        disposeObject(selection);
        selection = null;
      }
      const objects = loadedRoom && completeRoomModel && !currentBefore ? hitTargets : furniture;
      const object = id && (!currentBefore || existingIds.has(id)) ? objects.get(id) : null;
      if (object) {
        selection = new THREE.BoxHelper(object, "#b49cf0");
        selection.material.transparent = true;
        selection.material.opacity = 0.7;
        scene.add(selection);
      }
    };
    const updateVisibility = () => {
      if (themedDecor) themedDecor.visible = !currentBefore;
      layoutGrid.visible = currentEditing && !currentBefore && !completeRoomModel;
      proceduralRoomVisible = currentBefore || !loadedRoom;
      architecture.visible = proceduralRoomVisible;
      if (loadedRoom) loadedRoom.visible = !currentBefore;
      for (const [id, group] of furniture) {
        group.visible = currentBefore ? existingIds.has(id) : !loadedRoom || !completeRoomModel;
        group.traverse(object => { if (object.userData.afterAccent) object.visible = !currentBefore; });
        group.traverse(object => {
          if (!(object instanceof THREE.Mesh) || !object.userData.beforeColor) return;
          for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
            if (!('color' in surface)) continue;
            const colored = surface as THREE.MeshBasicMaterial;
            if (colored.userData.afterColor === undefined) colored.userData.afterColor = colored.color.getHex();
            colored.color.set(currentBefore ? object.userData.beforeColor : colored.userData.afterColor);
          }
        });
      }
      for (const group of hitTargets.values()) group.visible = !currentBefore;
      for (const marker of markers.values()) marker.visible = markersVisible;
      architecture.traverse(object => {
        if (object.userData.afterAccent) object.visible = !currentBefore;
        if (object instanceof THREE.Mesh && object.userData.beforeColor) {
          const surface = object.material as THREE.MeshStandardMaterial;
          if (!surface.userData.afterColor) surface.userData.afterColor = surface.color.getHex();
          surface.color.set(currentBefore ? object.userData.beforeColor : surface.userData.afterColor);
        }
      });
      updateSelection(selectedId);
    };
    let currentView = initialView();
    const defaultDirections = {
      perspective: reference ? new THREE.Vector3(1, 1, 1).normalize() : new THREE.Vector3(preview ? -1 : 1, preview ? 1.2 : 0.84, 1.2).normalize(),
      top: new THREE.Vector3(0, 1, 0.001).normalize(),
      front: new THREE.Vector3(0, 0.03, 1).normalize(),
    };
    const fitDistances = { perspective: 0, top: 0, front: 0 };
    const roomCenter = new THREE.Vector3();
    const updateCameraFit = () => {
      cameraBounds.getCenter(roomCenter);
      if (reference) roomCenter.set(0, .9, 0);
      const size = cameraBounds.getSize(new THREE.Vector3());
      const diagonal = size.length();
      const cameraAspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : (camera.right - camera.left) / (camera.top - camera.bottom);
      fitDistances.perspective = fittedDistance(cameraBounds, roomCenter, defaultDirections.perspective, cameraAspect, 36);
      fitDistances.top = fittedDistance(cameraBounds, roomCenter, defaultDirections.top, cameraAspect, 36);
      fitDistances.front = fittedDistance(cameraBounds, roomCenter, defaultDirections.front, cameraAspect, 36);
      controls.minDistance = Math.max(0.5, diagonal * 0.24);
      controls.maxDistance = Math.max(fitDistances.perspective, fitDistances.top, fitDistances.front) * 4;
      camera.near = Math.max(0.01, diagonal / 1000);
      camera.far = Math.max(80, controls.maxDistance + diagonal * 2);
      camera.updateProjectionMatrix();
      sun.target.position.copy(roomCenter);
      sun.position.copy(roomCenter).add(new THREE.Vector3(size.x * 0.35, diagonal, size.z * 0.8));
      const shadowExtent = diagonal * 0.75;
      sun.shadow.camera.left = -shadowExtent;
      sun.shadow.camera.right = shadowExtent;
      sun.shadow.camera.top = shadowExtent;
      sun.shadow.camera.bottom = -shadowExtent;
      sun.shadow.camera.far = diagonal * 4;
      sun.shadow.camera.updateProjectionMatrix();
    };
    const reset = () => {
      controls.target.copy(roomCenter);
      camera.position.copy(roomCenter).addScaledVector(defaultDirections[currentView], fitDistances[currentView]);
      if (camera instanceof THREE.OrthographicCamera) { camera.zoom = 1; camera.updateProjectionMatrix(); }
      controls.enableRotate = currentView === "perspective";
      // Clear any remaining damping before restoring the chosen orientation.
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.target.copy(roomCenter);
      camera.position.copy(roomCenter).addScaledVector(defaultDirections[currentView], fitDistances[currentView]);
      controls.update();
      controls.enableDamping = damping;
    };
    const restoreCamera = () => {
      if (!savedCamera || savedCamera.view !== currentView) { reset(); return; }
      controls.target.copy(savedCamera.target);
      camera.position.copy(savedCamera.position);
      camera.zoom = savedCamera.zoom;
      camera.updateProjectionMatrix();
      controls.enableRotate = currentView === "perspective";
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
    };
    let lastCommandSequence: number | null = savedCamera?.lastCommandSequence ?? null;
    runtime.current = {
      select: updateSelection,
      reset: () => { cancelDrag(); clearPlacementPreview(); lastCommandSequence = null; reset(); },
      setBefore: (nextBefore, nextMarkersVisible) => { if (nextBefore !== currentBefore) cancelDrag(); clearPlacementPreview(); currentBefore = nextBefore; markersVisible = nextMarkersVisible; updateVisibility(); },
      setEditing: (nextEditing) => { if (nextEditing !== currentEditing) cancelDrag(); if (!nextEditing) clearPlacementPreview(); currentEditing = nextEditing; layoutGrid.visible = currentEditing && !currentBefore && !completeRoomModel; },
      setPlacement: (item) => { if (item !== currentPlacement) clearPlacementPreview(); currentPlacement = item; },
      command: (nextCommand) => {
        if (lastCommandSequence === nextCommand.sequence) return;
        lastCommandSequence = nextCommand.sequence;
        cancelDrag();
        clearPlacementPreview();
        if (currentView !== "perspective" && (nextCommand.action === "left" || nextCommand.action === "right")) return;
        const damping = controls.enableDamping;
        controls.enableDamping = false;
        controls.update();
        const offset = camera.position.clone().sub(controls.target);
        if (nextCommand.action === "left" || nextCommand.action === "right") {
          offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), nextCommand.action === "left" ? Math.PI / 8 : -Math.PI / 8);
        } else if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = THREE.MathUtils.clamp(camera.zoom * (nextCommand.action === "in" ? 1.25 : .8), .25, 4);
          camera.updateProjectionMatrix();
        } else {
          const distance = THREE.MathUtils.clamp(offset.length() * (nextCommand.action === "in" ? 0.8 : 1.25), controls.minDistance, controls.maxDistance);
          offset.setLength(distance);
        }
        camera.position.copy(controls.target).add(offset);
        controls.update();
        controls.enableDamping = damping;
      },
      setView: (nextView) => {
        if (currentView === nextView) return;
        cancelDrag();
        clearPlacementPreview();
        currentView = nextView;
        reset();
      },
    };
    updateCameraFit();
    updateVisibility();
    restoreCamera();

    const loader = new GLTFLoader(loadingManager);
    const showModelFailure = () => {
      assetFailed = true;
      if (modelNotice.current && !disposed) modelNotice.current.hidden = false;
    };
    for (const item of design.items) {
      if (!item.modelUrl || completeRoomModel) continue;
      loader.load(item.modelUrl, (gltf) => {
        if (disposed) { disposeObject(gltf.scene); return; }
        const group = furniture.get(item.id);
        if (!group) { disposeObject(gltf.scene); return; }
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const modelSize = bounds.getSize(new THREE.Vector3());
        if (Math.min(modelSize.x, modelSize.y, modelSize.z) <= 0) {
          disposeObject(gltf.scene);
          showModelFailure();
          return;
        }
        const scale = Math.min(item.size[0] / modelSize.x, item.size[1] / modelSize.y, item.size[2] / modelSize.z);
        gltf.scene.scale.setScalar(scale);
        const center = bounds.getCenter(new THREE.Vector3());
        gltf.scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;
          // Imported owned furniture uses a catalog approximation; keep its
          // measured dimensions and the product/edited color from the room item.
          if (isManualFurniture(item)) {
            for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
              if ("color" in surface && surface.color instanceof THREE.Color) surface.color.set(item.color);
            }
          }
        });
        if (!item.existing && item.materialOverrides) {
          textureCleanups.push(applyMaterialOverrides(gltf.scene, item.materialOverrides, scale, () => {
            if (!disposed && textureNotice.current) textureNotice.current.hidden = false;
          }, loadingManager));
        }
        for (const child of [...group.children]) { group.remove(child); disposeObject(child); }
        group.scale.set(1, 1, 1);
        group.add(gltf.scene);
        if (selectedId === item.id) updateSelection(selectedId);
      }, undefined, showModelFailure);
    }
    if (design.modelUrl) {
      loader.load(design.modelUrl, (gltf) => {
        if (disposed) { disposeObject(gltf.scene); return; }
        const loadedBounds = new THREE.Box3().setFromObject(gltf.scene);
        if (loadedBounds.isEmpty()) {
          disposeObject(gltf.scene);
          showModelFailure();
          return;
        }
        // Both model kinds retain backend coordinates so item metadata stays aligned.
        gltf.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
        });
        scene.add(gltf.scene);
        loadedRoom = gltf.scene;
        if (completeRoomModel) {
          for (const item of design.items) {
            const group = new THREE.Group();
            group.userData.itemId = item.id;
            group.position.set(...item.position);
            group.position.y -= item.size[1] / 2;
            group.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
            // Furniture is already baked into the complete model. Invisible metadata
            // boxes preserve raycast selection and bounds without drawing duplicates.
            const hitTarget = new THREE.Mesh(
              new THREE.BoxGeometry(...item.size),
              new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
            );
            hitTarget.position.y = item.size[1] / 2;
            group.add(hitTarget);
            hitTargets.set(item.id, group);
            scene.add(group);
          }
        }
        updateVisibility();
        cameraBounds.copy(loadedBounds);
        cameraBounds.union(baseRoomBounds);
        updateCameraFit();
        restoreCamera();
      }, undefined, showModelFailure);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart: { x: number; y: number; time: number } | null = null;
    type FurnitureDrag = {
      pointerId: number;
      id: string;
      itemPosition: RoomItem["position"];
      position: RoomItem["position"];
      group: THREE.Group;
      origin: THREE.Vector3;
      hit: THREE.Vector3;
      plane: THREE.Plane;
      x: number;
      y: number;
      moved: boolean;
      controlsEnabled: boolean;
    };
    let drag: FurnitureDrag | null = null;
    const setRay = (event: Pick<PointerEvent, "clientX" | "clientY">) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    };
    let placementPreview: THREE.Group | null = null;
    clearPlacementPreview = () => {
      if (!placementPreview) return;
      scene.remove(placementPreview);
      disposeObject(placementPreview);
      placementPreview = null;
    };
    const placementPosition = (event: DragEvent): RoomItem["position"] | null => {
      const item = currentPlacement;
      if (!item || !currentEditing || !markersVisible || currentBefore || completeRoomModel) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;
      setRay(event);
      const hit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -gridFloor), new THREE.Vector3());
      if (!hit || hit.x < gridBounds.min.x || hit.x > gridBounds.max.x || hit.z < gridBounds.min.z || hit.z > gridBounds.max.z) return null;
      const angle = THREE.MathUtils.degToRad(item.rotation ?? 0);
      const halfWidth = (Math.abs(Math.cos(angle)) * item.size[0] + Math.abs(Math.sin(angle)) * item.size[2]) / 2;
      const halfDepth = (Math.abs(Math.sin(angle)) * item.size[0] + Math.abs(Math.cos(angle)) * item.size[2]) / 2;
      if (halfWidth * 2 > gridBounds.max.x - gridBounds.min.x || halfDepth * 2 > gridBounds.max.z - gridBounds.min.z) return null;
      if (item.size[1] > (design.room?.height ?? baseRoomBounds.max.y - gridFloor)) return null;
      const position = snapItemPosition(item, [hit.x, item.position[1], hit.z], [0, 2], design.room);
      // Inferred/demo rooms may be offset from the origin; constrain their bounds
      // while retaining the same 10 cm grid used for moving existing furniture.
      for (const [axis, halfSize] of [[0, halfWidth], [2, halfDepth]] as const) {
        const name = axis === 0 ? "x" : "z";
        const minimum = Math.ceil((gridBounds.min[name] + halfSize - 1e-9) / LAYOUT_GRID_STEP) / 10;
        const maximum = Math.floor((gridBounds.max[name] - halfSize + 1e-9) / LAYOUT_GRID_STEP) / 10;
        if (minimum > maximum) return null;
        position[axis] = Math.max(minimum, Math.min(maximum, position[axis]));
      }
      position[1] = gridFloor + item.size[1] / 2;
      return position;
    };
    const dragOver = (event: DragEvent) => {
      if (!currentPlacement) return;
      const position = placementPosition(event);
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = position ? "copy" : "none";
      if (!position) { if (placementPreview) placementPreview.visible = false; return; }
      if (!placementPreview) {
        placementPreview = createFurniture(currentPlacement, accent, oshi, loadingManager);
        placementPreview.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = false;
          for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
            surface.transparent = true;
            surface.opacity = 0.55;
            surface.depthWrite = false;
          }
        });
        scene.add(placementPreview);
      }
      placementPreview.visible = true;
      placementPreview.position.set(position[0], position[1] - currentPlacement.size[1] / 2, position[2]);
    };
    const drop = (event: DragEvent) => {
      if (!currentPlacement) return;
      event.preventDefault();
      event.stopPropagation();
      const position = placementPosition(event);
      clearPlacementPreview();
      if (position) placeItem(position);
    };
    const dragLeave = (event: DragEvent) => {
      if (event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return;
      if (placementPreview) placementPreview.visible = false;
    };
    host.addEventListener("dragover", dragOver);
    host.addEventListener("drop", drop);
    host.addEventListener("dragleave", dragLeave);
    window.addEventListener("dragend", clearPlacementPreview);
    const findItem = (event: PointerEvent) => {
      setRay(event);
      const objects = loadedRoom && completeRoomModel && !currentBefore ? hitTargets : furniture;
      const markerHit = raycaster.intersectObjects([...markers.values()].filter(marker => marker.visible), false)[0];
      const hit = markerHit ?? raycaster.intersectObjects([...objects.values()].filter(group => group.visible), true)[0];
      let object: THREE.Object3D | null = hit?.object ?? null;
      while (object) {
        if (typeof object.userData.itemId === "string") return object.userData.itemId as string;
        object = object.parent;
      }
      return null;
    };
    const releaseDrag = (restore: boolean) => {
      const active = drag;
      if (!active) return null;
      drag = null;
      pointerStart = null;
      if (restore) active.group.position.copy(active.origin);
      active.group.updateMatrixWorld(true);
      selection?.update();
      controls.enabled = active.controlsEnabled;
      renderer.domElement.style.cursor = currentEditing ? "grab" : "pointer";
      if (renderer.domElement.hasPointerCapture(active.pointerId)) renderer.domElement.releasePointerCapture(active.pointerId);
      return active;
    };
    cancelDrag = () => { releaseDrag(true); pointerStart = null; };
    const pointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) { pointerStart = null; return; }
      pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
      if (!currentEditing || currentBefore || completeRoomModel || drag) return;
      const id = findItem(event);
      const item = design.items.find(item => item.id === id);
      const group = id ? furniture.get(id) : undefined;
      if (!id || !item || !group) return;
      // Freeze any previous orbit damping before taking the drag's world-space offset.
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
      setRay(event);
      // A nearly horizontal front-view ray is unstable against the floor plane.
      // In front view, preserve depth and expose only screen-aligned X movement.
      const plane = currentView === "front"
        ? new THREE.Plane(new THREE.Vector3(0, 0, 1), -item.position[2])
        : new THREE.Plane(new THREE.Vector3(0, 1, 0), -item.position[1]);
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit) return;
      drag = { pointerId: event.pointerId, id, itemPosition: [...item.position], position: [...item.position], group, origin: group.position.clone(), hit, plane, x: event.clientX, y: event.clientY, moved: false, controlsEnabled: controls.enabled };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grab";
      updateSelection(id);
      selectItem(id);
      event.preventDefault();
      // Capture precedes OrbitControls' pointerdown listener: furniture moves while
      // empty-space drags still reach the existing camera controls.
      event.stopImmediatePropagation();
    };
    const pointerUp = (event: PointerEvent) => {
      if (drag?.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const active = drag;
        const delta = active.group.position.clone().sub(active.origin);
        const changed = active.moved && Math.hypot(delta.x, delta.z) > .0005;
        releaseDrag(!changed);
        if (changed) {
          moveItem(active.id, active.position);
        }
        return;
      }
      const start = pointerStart;
      pointerStart = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5 || performance.now() - start.time > 600) return;
      const id = findItem(event);
      if (id) selectItem(id);
    };
    const pointerMove = (event: PointerEvent) => {
      if (drag?.pointerId === event.pointerId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <= 5) return;
        setRay(event);
        const hit = raycaster.ray.intersectPlane(drag.plane, new THREE.Vector3());
        if (!hit) return;
        const delta = hit.sub(drag.hit);
        const item = design.items.find(item => item.id === drag?.id);
        if (!item) return;
        const position = snapFurnitureEditPosition(item, [drag.itemPosition[0] + delta.x, drag.itemPosition[1], drag.itemPosition[2] + delta.z], currentView === "front" ? [0] : [0, 2], design);
        if (!position) return;
        drag.position = position;
        // Preserve the model group's origin offset while previewing the snapped position.
        drag.group.position.copy(drag.origin).add(new THREE.Vector3(position[0] - drag.itemPosition[0], 0, position[2] - drag.itemPosition[2]));
        drag.group.updateMatrixWorld(true);
        drag.moved = true;
        selection?.update();
        renderer.domElement.style.cursor = "grabbing";
        return;
      }
      renderer.domElement.style.cursor = event.buttons ? "grabbing" : findItem(event) ? currentEditing && !currentBefore && !completeRoomModel ? "grab" : "pointer" : "grab";
    };
    const pointerCancel = () => { cancelDrag(); };
    const lostPointerCapture = (event: PointerEvent) => { if (drag?.pointerId === event.pointerId) cancelDrag(); };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !drag) return;
      cancelDrag();
      event.preventDefault();
      event.stopPropagation();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      cancelDrag();
      if (fallback.current) fallback.current.hidden = false;
      if (!readySent) { readySent = true; window.clearTimeout(previewDeadline); reportReady(false); }
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown, true);
    renderer.domElement.addEventListener("pointerup", pointerUp, true);
    renderer.domElement.addEventListener("pointermove", pointerMove, true);
    renderer.domElement.addEventListener("pointercancel", pointerCancel);
    renderer.domElement.addEventListener("lostpointercapture", lostPointerCapture);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("blur", pointerCancel);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    const resize = () => {
      previewNeedsRender = true;
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      const aspect = width / height;
      const previousAspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : (camera.right - camera.left) / (camera.top - camera.bottom);
      if (Math.abs(previousAspect - aspect) > 0.001) {
        const oldFitDistance = fitDistances[currentView];
        const direction = camera.position.clone().sub(controls.target);
        const zoomRatio = direction.length() / oldFitDistance;
        if (camera instanceof THREE.PerspectiveCamera) camera.aspect = aspect;
        else { camera.left = -referenceHeight * aspect / 2; camera.right = referenceHeight * aspect / 2; camera.updateProjectionMatrix(); }
        updateCameraFit();
        camera.position.copy(controls.target).addScaledVector(direction.normalize(), fitDistances[currentView] * zoomRatio);
        controls.update();
      }
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const render = () => {
      const cameraChanged = controls.update();
      // 一覧の静止した視点は描き直さず、回転・読み込み・リサイズ時に描画する。
      if (preview && readySent && assetsReady && !cameraChanged && !previewNeedsRender) return;
      previewNeedsRender = false;
      const markerObjects = loadedRoom && completeRoomModel && !currentBefore ? hitTargets : furniture;
      for (const [id, marker] of markers) {
        const group = markerObjects.get(id);
        marker.visible = markersVisible && Boolean(group?.visible);
        if (!marker.visible || !group) continue;
        const bounds = new THREE.Box3().setFromObject(group);
        bounds.getCenter(marker.position);
        marker.position.y = bounds.max.y + 0.14;
      }
      // Fade the near wall when orbiting behind the room so its contents remain visible.
      if (proceduralRoomVisible) {
        for (const { object, wall } of cutawayWalls) {
          const nearSide = wall === "west" ? camera.position.x < roomCenter.x - 0.3
            : wall === "east" ? camera.position.x > roomCenter.x + 0.3
              : wall === "north" ? camera.position.z < roomCenter.z - 0.3
                : camera.position.z > roomCenter.z + 0.3;
          object.traverse(child => {
            if (!(child instanceof THREE.Mesh)) return;
            for (const surface of Array.isArray(child.material) ? child.material : [child.material]) {
              surface.opacity = nearSide ? 0.12 : 1;
              surface.depthWrite = !nearSide;
            }
          });
        }
      }
      renderer.render(scene, camera);
      if (assetsReady && !readySent) {
        readySent = true;
        window.clearTimeout(previewDeadline);
        reportReady(!assetFailed);
      }
    };
    const contextRestored = () => {
      if (disposed) return;
      previewNeedsRender = true;
      if (fallback.current) fallback.current.hidden = true;
      renderer.setAnimationLoop(render);
    };
    renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
    // Draw the rebuilt scene immediately so a committed drag never exposes a
    // blank canvas while waiting for the next animation frame.
    render();
    renderer.setAnimationLoop(render);
    return () => {
      cancelDrag();
      clearPlacementPreview();
      cameraState.current = { id: design.id, position: camera.position.clone(), target: controls.target.clone(), zoom: camera.zoom, view: currentView, lastCommandSequence };
      disposed = true;
      window.clearTimeout(previewDeadline);
      textureCleanups.forEach(cleanup => cleanup());
      runtime.current = null;
      observer.disconnect();
      host.removeEventListener("dragover", dragOver);
      host.removeEventListener("drop", drop);
      host.removeEventListener("dragleave", dragLeave);
      window.removeEventListener("dragend", clearPlacementPreview);
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", pointerDown, true);
      renderer.domElement.removeEventListener("pointerup", pointerUp, true);
      renderer.domElement.removeEventListener("pointermove", pointerMove, true);
      renderer.domElement.removeEventListener("pointercancel", pointerCancel);
      renderer.domElement.removeEventListener("lostpointercapture", lostPointerCapture);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("blur", pointerCancel);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
      controls.dispose();
      disposeObject(scene);
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [design, preview]);

  useEffect(() => { runtime.current?.select(selectedItemId); }, [design, selectedItemId]);
  useEffect(() => { runtime.current?.setView(view); }, [design, view]);
  useEffect(() => { runtime.current?.reset(); }, [resetKey]);
  useEffect(() => { runtime.current?.setBefore(legacyBefore, !before && !preview); }, [design, legacyBefore, before, preview]);
  useEffect(() => { runtime.current?.setEditing(editing && Boolean(onMoveItem) && !before); }, [design, editing, onMoveItem, before]);
  useEffect(() => { runtime.current?.setPlacement(!before && onPlaceItem ? placementItem : null); }, [design, placementItem, onPlaceItem, before]);
  useEffect(() => { canvasHost.current?.querySelector("canvas")?.setAttribute("aria-label", instructions); }, [design, instructions]);
  useEffect(() => { if (command) runtime.current?.command(command); }, [design, command]);

  return (
    <div className="room-viewer">
      <div ref={canvasHost} className="viewer-canvas" style={{ position: "absolute", inset: 0 }} />
      {dimensionItem && <div role="status" style={{ position: "absolute", left: 16, bottom: 16, padding: "8px 12px", background: "rgba(29,27,38,.88)", border: "1px solid #6e6a7c", borderRadius: 8, color: "#fff", fontSize: 12, pointerEvents: "none" }}>幅 {Math.round(dimensionItem.size[0] * 100)} × 高さ {Math.round(dimensionItem.size[1] * 100)} × 奥行き {Math.round(dimensionItem.size[2] * 100)} cm</div>}
      <div ref={fallback} className="viewer-fallback" hidden role="status">
        <strong>この環境では3Dを表示できません</strong>
      </div>
      <div ref={modelNotice} className="viewer-model-notice" hidden role="status">
        3Dモデルを読み込めませんでした。
      </div>
      <div ref={textureNotice} className="viewer-model-notice" style={{bottom:84}} hidden role="status">
        一部の素材を読み込めませんでした。
      </div>
    </div>
  );
}

export default RoomViewer;
