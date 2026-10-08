import * as THREE from "three";
import type { RoomDesign } from "../../domain/room";
import { REFERENCE_FLOOR_BOUNDS } from './roomBounds';

// The supplied isometric drawing is reconstructed as editable 3D geometry.
// Face colors are unlit so the reference palette survives camera changes.
const boxes = [
  {"id": "architecture", "position": [-0.0996, -0.12, -0.0996], "size": [4.2008, 0.24, 4.2008], "colors": ["#e6e1d8", "#cfc8bc", "#cfb391"]},
  {"id": "3", "position": [0.47956, 0.012, 0.39988], "size": [1.91911, 0.024, 1.75976], "colors": ["#a491d1", "#8a7ab0", "#bba5ee"]},
  {"id": "3", "position": [0.48053, 0.026, 0.3997], "size": [1.44107, 0.004, 1.27941], "colors": ["#b4a5d5", "#978bb3", "#cdbcf3"]},
  {"id": "bed", "position": [-1.27947, 0.48, -1.92956], "size": [1.44107, 0.96, 0.14087], "colors": ["#beab90", "#a09079", "#d9c3a4"]},
  {"id": "bed", "position": [-1.2799, 0.18, -0.85035], "size": [1.44107, 0.36, 2.01842], "colors": ["#beab90", "#a09079", "#d9c3a4"]},
  {"id": "bed", "position": [-1.27953, 0.48, -0.84998], "size": [1.40181, 0.24, 1.97916], "colors": ["#d8d6d4", "#b6b4b2", "#f6f4f1"]},
  {"id": "bed", "position": [-1.57982, 0.67, -1.59945], "size": [0.51962, 0.14, 0.40184], "colors": ["#e0e0e0", "#bcbcbc", "#ffffff"]},
  {"id": "bed", "position": [-0.9796, 0.67, -1.59967], "size": [0.52192, 0.14, 0.39953], "colors": ["#e0e0e0", "#bcbcbc", "#ffffff"]},
  {"id": "8", "position": [-1.27973, 0.504, -0.54996], "size": [1.44107, 0.288, 1.45954], "colors": ["#8a72c7", "#7460a7", "#9d82e3"]},
  {"id": "desk", "position": [0.12002, 0.46, -1.60049], "size": [0.08083, 0.92, 0.71822], "colors": ["#beab90", "#a09079", "#d9c3a4"]},
  {"id": "desk", "position": [1.48013, 0.46, -1.59945], "size": [0.08083, 0.92, 0.72053], "colors": ["#beab90", "#a09079", "#d9c3a4"]},
  {"id": "desk", "position": [0.79976, 0.96, -1.5997], "size": [1.43876, 0.08, 0.80136], "colors": ["#ccbea8", "#ab9f8e", "#e8d8c0"]},
  {"id": "desk", "position": [0.79982, 1.1, -1.76015], "size": [0.07852, 0.2, 0.08083], "colors": ["#33323d", "#2b2a33", "#3b3946"]},
  {"id": "desk", "position": [0.79959, 1.44, -1.81004], "size": [0.79905, 0.48, 0.06004], "colors": ["#7d5ce6", "#2c2a35", "#2c2a35"]},
  {"id": "desk", "position": [0.43969, 1.01, -1.56025], "size": [0.39953, 0.02, 0.15935], "colors": ["#cdcbd1", "#acaab0", "#e9e7ee"]},
  {"id": "2", "position": [-1.88047, 0.64, 1.15985], "size": [0.24018, 1.28, 1.19858], "colors": ["#e0e0e0", "#bcbcbc", "#ffffff"]},
  {"id": "2", "position": [-1.66002, 0.48, 1.15976], "size": [0.20092, 0.96, 1.19858], "colors": ["#e0e0e0", "#bcbcbc", "#ffffff"]},
  {"id": "2", "position": [-1.45956, 0.32, 1.16046], "size": [0.20092, 0.64, 1.20089], "colors": ["#e0e0e0", "#bcbcbc", "#ffffff"]},
  {"id": "chair", "position": [0.75997, 0.03, -0.84044], "size": [0.39953, 0.06, 0.39953], "colors": ["#33323d", "#2b2a33", "#3b3946"]},
  {"id": "chair", "position": [0.75947, 0.29, -0.83979], "size": [0.07852, 0.46, 0.08083], "colors": ["#33323d", "#2b2a33", "#3b3946"]},
  {"id": "chair", "position": [0.76039, 0.584, -0.84003], "size": [0.48036, 0.128, 0.48036], "colors": ["#4f4175", "#423663", "#5a4a86"]},
  {"id": "chair", "position": [0.75223, 0.996, -0.62764], "size": [0.48036, 0.712, 0.08083], "colors": ["#4f4175", "#423663", "#5a4a86"]},
  {"id": "5", "position": [-0.144, 0.098, 0.25553], "size": [0.39953, 0.196, 0.39953], "colors": ["#6e4cbe", "#5d40a0", "#7e57d9"]},
  {"id": "architecture", "position": [0.47953, 0.18, 0.27976], "size": [0.71822, 0.36, 0.48036], "colors": ["#afa291", "#93887a", "#c7b9a5"]},
  {"id": "architecture", "position": [0.47994, 0.4, 0.28018], "size": [0.79905, 0.08, 0.56118], "colors": ["#ccbea8", "#ab9f8e", "#e8d8c0"]},
  {"id": "6", "position": [1.69987, 0.02, -0.8601], "size": [0.19861, 0.04, 0.20092], "colors": ["#33323d", "#2b2a33", "#3b3946"]},
  {"id": "6", "position": [1.70019, 0.9, -0.85978], "size": [0.03926, 1.72, 0.04157], "colors": ["#33323d", "#2b2a33", "#3b3946"]},
  {"id": "6", "position": [1.70028, 1.92, -0.85969], "size": [0.27944, 0.32, 0.28175], "colors": ["#cdb8ff", "#b49cf0", "#e6dbff"]},
  {"id": "5", "position": [0.41559, 0.088, 0.89594], "size": [0.39953, 0.176, 0.39953], "colors": ["#ac9ad4", "#9182b3", "#c4b0f2"]},
  {"id": "7", "position": [1.64055, 0.18, 1.52046], "size": [0.32101, 0.36, 0.32101], "colors": ["#b07a5e", "#94664f", "#c98b6b"]},
  {"id": "2", "position": [-1.89961, 1.29, 0.72387], "size": [0.10392, 0.02, 0.16859], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.9004, 1.446, 0.72424], "size": [0.02309, 0.292, 0.16859], "colors": ["#7052cf", "#7d5ce6", "#ffffff"]},
  {"id": "2", "position": [-1.8997, 1.29, 0.96396], "size": [0.10392, 0.02, 0.16859], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.90049, 1.446, 0.96433], "size": [0.02309, 0.292, 0.16859], "colors": ["#a28cd8", "#b49cf0", "#ffffff"]},
  {"id": "2", "position": [-1.89979, 1.29, 1.20404], "size": [0.10392, 0.02, 0.16859], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.90057, 1.446, 1.20441], "size": [0.02309, 0.292, 0.16859], "colors": ["#7052cf", "#7d5ce6", "#ffffff"]},
  {"id": "2", "position": [-1.89988, 1.29, 1.44413], "size": [0.10392, 0.02, 0.16859], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.89951, 1.446, 1.4445], "size": [0.0254, 0.292, 0.16859], "colors": ["#cbb05f", "#e2c46a", "#ffffff"]},
  {"id": "2", "position": [-1.67565, 0.97, 0.84391], "size": [0.10392, 0.02, 0.16859], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.67644, 1.126, 0.84428], "size": [0.02309, 0.292, 0.16859], "colors": ["#a28cd8", "#b49cf0", "#ffffff"]},
  {"id": "2", "position": [-1.67574, 0.97, 1.08399], "size": [0.10392, 0.02, 0.16859], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.67652, 1.126, 1.08436], "size": [0.02309, 0.292, 0.16859], "colors": ["#7052cf", "#7d5ce6", "#ffffff"]},
  {"id": "2", "position": [-1.67583, 0.97, 1.32408], "size": [0.10392, 0.02, 0.16859], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.67546, 1.126, 1.32445], "size": [0.0254, 0.292, 0.16859], "colors": ["#bbabde", "#d0bff7", "#ffffff"]},
  {"id": "2", "position": [-1.67592, 0.97, 1.56417], "size": [0.10392, 0.02, 0.16859], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.67555, 1.126, 1.56454], "size": [0.0254, 0.292, 0.16859], "colors": ["#7052cf", "#7d5ce6", "#ffffff"]},
  {"id": "2", "position": [-1.4763, 0.65, 0.72456], "size": [0.10392, 0.02, 0.16859], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.47593, 0.806, 0.72377], "size": [0.02309, 0.292, 0.16859], "colors": ["#7052cf", "#7d5ce6", "#ffffff"]},
  {"id": "2", "position": [-1.47639, 0.65, 0.96349], "size": [0.10392, 0.02, 0.16628], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.47602, 0.806, 0.96386], "size": [0.02309, 0.292, 0.16859], "colors": ["#cbb05f", "#e2c46a", "#ffffff"]},
  {"id": "2", "position": [-1.47648, 0.65, 1.20358], "size": [0.10392, 0.02, 0.16628], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.47611, 0.806, 1.20395], "size": [0.02309, 0.292, 0.16859], "colors": ["#a28cd8", "#b49cf0", "#ffffff"]},
  {"id": "2", "position": [-1.47657, 0.65, 1.44367], "size": [0.10392, 0.02, 0.16628], "colors": ["#d5d4d9", "#b3b2b6", "#f3f1f7"]},
  {"id": "2", "position": [-1.4762, 0.806, 1.44404], "size": [0.02309, 0.292, 0.16859], "colors": ["#7052cf", "#7d5ce6", "#ffffff"]},
];
const planes = [
  {"id": "architecture", "points": [[-2.200801, -0.0004, 2], [-1.999883, 5.9e-05, 2], [-1.999883, 2.600059, 2], [-2.200801, 2.5996, 2]], "color": "#f6f3fb", "wall": null},
  {"id": "architecture", "points": [[-1.999, 0.000541, -2.199918], [-1.999, 0.000941, 2.000883], [-1.999, 2.600941, 2.000883], [-1.999, 2.600541, -2.199918]], "color": "#d4c8ea", "wall": "left"},
  {"id": "architecture", "points": [[-2.2, 2.6, -2.2], [-1.999541, 2.6, -2.200459], [-1.999941, 2.6, 1.999941], [-2.2004, 2.6, 2.0004]], "color": "#f6f3fb", "wall": null},
  {"id": "architecture", "points": [[-1.999, 0.001, -1.999], [2.000883, 0.000941, -1.999], [2.000883, 2.600941, -1.999], [-1.999, 2.601, -1.999]], "color": "#e5ddf3", "wall": "back"},
  {"id": "architecture", "points": [[2, -0.0004, -2.200801], [2, 5.9e-05, -1.999883], [2, 2.600059, -1.999883], [2, 2.5996, -2.200801]], "color": "#f6f3fb", "wall": null},
  {"id": "architecture", "points": [[-1.999541, 2.6, -2.200459], [2.0004, 2.6, -2.2004], [1.999941, 2.6, -1.999941], [-2.0, 2.6, -2.0]], "color": "#f6f3fb", "wall": null},
  {"id": "architecture", "points": [[-1.988, 0.004536, -1.994928], [-1.988, 0.004477, 2.004954], [-1.988, 0.104477, 2.004954], [-1.988, 0.104536, -1.994928]], "color": "#f4f1ec", "wall": null},
  {"id": "architecture", "points": [[-1.994928, 0.004536, -1.988], [2.004954, 0.004477, -1.988], [2.004954, 0.104477, -1.988], [-1.994928, 0.104536, -1.988]], "color": "#f4f1ec", "wall": null},
  {"id": "1", "points": [[-1.986, 2.193608, -2.006785], [-1.986, 2.193549, 1.993098], [-1.986, 2.533549, 1.993098], [-1.986, 2.533608, -2.006785]], "color": "rgba(170,130,255,0.28)", "wall": null},
  {"id": "1", "points": [[-2.006785, 2.193608, -1.986], [1.993098, 2.193549, -1.986], [1.993098, 2.533549, -1.986], [-2.006785, 2.533608, -1.986]], "color": "rgba(170,130,255,0.28)", "wall": null},
  {"id": "1", "points": [[-1.986, 2.462453, -2.009094], [-1.986, 2.462394, 1.990789], [-1.986, 2.510394, 1.990789], [-1.986, 2.510453, -2.009094]], "color": "#e2d6ff", "wall": null},
  {"id": "1", "points": [[-2.009094, 2.462453, -1.986], [1.990789, 2.462394, -1.986], [1.990789, 2.510394, -1.986], [-2.009094, 2.510453, -1.986]], "color": "#e2d6ff", "wall": null},
  {"id": "architecture", "points": [[0.176362, 1.296181, -1.976], [1.45577, 1.295885, -1.976], [1.45577, 2.335885, -1.976], [0.176362, 2.336181, -1.976]], "color": "#ffffff", "wall": null},
  {"id": "architecture", "points": [[0.231787, 1.351894, -1.976], [0.792972, 1.352486, -1.976], [0.792972, 2.272486, -1.976], [0.231787, 2.271894, -1.976]], "color": "#c6d6e4", "wall": null},
  {"id": "architecture", "points": [[0.832232, 1.352116, -1.976], [1.391107, 1.351553, -1.976], [1.391107, 2.271553, -1.976], [0.832232, 2.272116, -1.976]], "color": "#c6d6e4", "wall": null},
  {"id": "architecture", "points": [[-0.040722, 1.079639, -1.976], [0.199456, 1.079728, -1.976], [0.199456, 2.439728, -1.976], [-0.040722, 2.439639, -1.976]], "color": "#b8a3e6", "wall": null},
  {"id": "architecture", "points": [[1.400344, 1.080172, -1.976], [1.640522, 1.080261, -1.976], [1.640522, 2.440261, -1.976], [1.400344, 2.440172, -1.976]], "color": "#b8a3e6", "wall": null},
  {"id": "4", "points": [[-1.976, 1.176299, -1.583402], [-1.976, 1.176521, -0.982958], [-1.976, 1.856521, -0.982958], [-1.976, 1.856299, -1.583402]], "color": "#ffffff", "wall": null},
  {"id": "4", "points": [[-1.976, 1.232012, -1.527976], [-1.976, 1.23219, -1.047621], [-1.976, 1.79219, -1.047621], [-1.976, 1.792012, -1.527976]], "color": "#7d5ce6", "wall": null},
  {"id": "4", "points": [[-1.976, 1.348509, -1.430981], [-1.976, 1.348228, -1.151544], [-1.976, 1.608228, -1.151544], [-1.976, 1.608509, -1.430981]], "color": "#d9cbff", "wall": null},
  {"id": "4", "points": [[-1.976, 1.256566, -0.862869], [-1.976, 1.255633, -0.264734], [-1.976, 1.775633, -0.264734], [-1.976, 1.776566, -0.862869]], "color": "#ffffff", "wall": null},
  {"id": "4", "points": [[-1.976, 1.312278, -0.807443], [-1.976, 1.312456, -0.327088], [-1.976, 1.712456, -0.327088], [-1.976, 1.712278, -0.807443]], "color": "#c6b2f5", "wall": null},
  {"id": "4", "points": [[-1.976, 1.427621, -0.712758], [-1.976, 1.428495, -0.431011], [-1.976, 1.528495, -0.431011], [-1.976, 1.527621, -0.712758]], "color": "#7d5ce6", "wall": null},
];
const anchors: Record<string, {position: number[]; size: number[]}> = {
  "bed": {"position": [-1.27968, 0.48, -0.92057], "size": [1.4415, 0.96, 2.15885]},
  "desk": {"position": [0.80007, 0.84, -1.5997], "size": [1.44094, 1.68, 0.80136]},
  "chair": {"position": [0.75631, 0.676, -0.83372], "size": [0.48852, 1.352, 0.49299]},
  "1": {"position": [-0.008, 2.36358, -0.008], "size": [4.00219, 0.34006, 4.00219]},
  "2": {"position": [-1.67983, 0.796, 1.16046], "size": [0.64146, 1.592, 1.20089]},
  "3": {"position": [0.47956, 0.014, 0.39988], "size": [1.91911, 0.04, 1.75976]},
  "4": {"position": [-1.976, 1.51641, -0.92407], "size": [0.04, 0.68022, 1.31867]},
  "5": {"position": [0.13579, 0.098, 0.57573], "size": [0.95912, 0.196, 1.03994]},
  "6": {"position": [1.70028, 1.04, -0.85969], "size": [0.27944, 2.08, 0.28175]},
  "7": {"position": [1.64055, 0.51, 1.52046], "size": [0.32101, 1.02, 0.32101]},
  "8": {"position": [-1.27973, 0.504, -0.54996], "size": [1.44107, 0.288, 1.45954]},
};
const defaultColors: Record<string, string> = { bed: '#d9c3a4', desk: '#e8d8c0', chair: '#4a4756', '1': '#e2d6ff', '2': '#ffffff', '3': '#bba5ee', '4': '#b49cf0', '5': '#7e57d9', '6': '#cdb8ff', '7': '#7aa36a', '8': '#9d82e3' };

function surface(color: string): THREE.MeshBasicMaterial {
  const match = color.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  return new THREE.MeshBasicMaterial({ color: match ? `rgb(${match[1]},${match[2]},${match[3]})` : color, side: THREE.DoubleSide, transparent: Boolean(match), opacity: match ? Number(match[4]) : 1, depthWrite: !match, toneMapped: false });
}

export function usesReferenceRoom(design: RoomDesign): boolean {
  return design.source === 'demo' && design.style === 'oshi';
}

export function buildReferenceRoom(scene: THREE.Scene, design: RoomDesign): { architecture: THREE.Group; furniture: Map<string, THREE.Group>; bounds: THREE.Box3; floorBounds: THREE.Box3 } {
  const architecture = new THREE.Group();
  const furniture = new Map<string, THREE.Group>();
  scene.add(architecture);
  for (const item of design.items) {
    const group = new THREE.Group();
    group.userData.itemId = item.id;
    furniture.set(item.id, group);
    scene.add(group);
  }
  const groupFor = (id: string) => id === 'architecture' ? architecture : furniture.get(id);
  const tint = (id: string, original: string, shade = 1): string => {
    const item = design.items.find(item => item.id === id);
    if (!item || item.color.toLowerCase() === defaultColors[id]) return original;
    const color = new THREE.Color(item.color);
    color.multiplyScalar(shade);
    return `#${color.getHexString()}`;
  };
  for (const descriptor of boxes) {
    const parent = groupFor(descriptor.id);
    if (!parent) continue;
    const [front, right, top] = descriptor.colors;
    const preserveWood = descriptor.id === 'bed' || descriptor.id === 'desk' || descriptor.id === 'chair' || descriptor.id === '7';
    const colors = preserveWood ? [front, right, top] : [tint(descriptor.id, front, .88), tint(descriptor.id, right, .74), tint(descriptor.id, top)];
    const materials = [colors[1], colors[1], colors[2], colors[2], colors[0], colors[0]].map(surface);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...descriptor.size as [number, number, number]), materials);
    mesh.position.set(...descriptor.position as [number, number, number]);
    if (descriptor.id === 'chair') mesh.userData.beforeColor = '#5b5762';
    parent.add(mesh);
  }
  let posterLayer = 0;
  for (const descriptor of planes) {
    const parent = groupFor(descriptor.id);
    if (!parent) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(descriptor.points.flat(), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    const color = descriptor.wall && design.wallColor ? design.wallColor : tint(descriptor.id, descriptor.color);
    const mesh = new THREE.Mesh(geometry, surface(color));
    // Frames, glass, and artwork are separate physical layers. Coplanar meshes
    // produce triangle-shaped depth artifacts even with a one-unit polygon bias.
    if (descriptor.id === '4') {
      mesh.position.x = (posterLayer++ % 3) * .004;
    } else if (descriptor.color === '#c6d6e4') {
      mesh.position.z = .004;
    } else if (descriptor.color === '#b8a3e6') {
      mesh.position.z = .008;
    }
    if (descriptor.wall) { mesh.name = `cutaway-${descriptor.wall === 'left' ? 'left' : 'back'}-wall`; mesh.userData.beforeColor = descriptor.wall === 'left' ? '#dcd6cd' : '#ebe6df'; }
    if (descriptor.id === 'architecture' && descriptor.color === '#b8a3e6') mesh.userData.beforeColor = '#d8d1c6';
    parent.add(mesh);
  }
  // The podium is a real horizontal cylinder, rather than an image or sprite.
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(3.756, 3.756, .2, 96), [surface('#1d1a25'), surface('#29253a'), surface('#1d1a25')]);
  podium.position.set(-.1, -.42, -.1);
  architecture.add(podium);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.265, .008, 4, 96), surface('#3a3550'));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-.1, -.319, -.1);
  architecture.add(ring);
  for (let row = 0; row < 9; row++) {
    const x = .4 + row * .4 - 2;
    const vertices = [x, .003, -2.2, x, .003, 2];
    const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)), new THREE.LineBasicMaterial({ color: '#bf9f7c', toneMapped: false }));
    architecture.add(line);
  }
  const lamp = furniture.get('6');
  if (lamp) {
    const glow = new THREE.Mesh(new THREE.SphereGeometry(.555, 24, 16), new THREE.MeshBasicMaterial({ color: tint('6', '#c8aaff'), transparent: true, opacity: .28, depthWrite: false, toneMapped: false }));
    glow.position.set(1.7003, 1.92, -.86);
    lamp.add(glow);
  }
  const plant = furniture.get('7');
  if (plant) {
    for (let tier = 0; tier < 2; tier++) for (let leaf = 0; leaf < (tier ? 5 : 7); leaf++) {
      const count = tier ? 5 : 7;
      const angle = -Math.PI + .35 + leaf * (Math.PI - .7) / (count - 1);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), surface(tint('7', leaf % 2 ? '#7aa36a' : '#5f8a54', leaf % 2 ? 1 : .78)));
      mesh.scale.set(tier ? .17 : .19, .078, .025);
      mesh.position.set(1.6405 + Math.cos(angle) * .25, .78 + tier * .21 + Math.sin(-angle) * .1, 1.5205);
      mesh.rotation.z = angle;
      plant.add(mesh);
    }
  }
  for (const item of design.items) {
    const group = furniture.get(item.id);
    const anchor = anchors[item.id];
    if (!group || !anchor) continue;
    const center = new THREE.Vector3(...anchor.position as [number, number, number]);
    for (const child of group.children) child.position.sub(center);
    group.position.set(...item.position);
    group.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0);
    group.scale.set(...item.size.map((value, index) => value / anchor.size[index]) as [number, number, number]);
  }
  const floorBounds = new THREE.Box3(
    new THREE.Vector3(...REFERENCE_FLOOR_BOUNDS.min),
    new THREE.Vector3(...REFERENCE_FLOOR_BOUNDS.max),
  );
  return { architecture, furniture, floorBounds, bounds: new THREE.Box3(new THREE.Vector3(-3.856, -.52, -3.856), new THREE.Vector3(3.656, 2.6, 3.656)) };
}
