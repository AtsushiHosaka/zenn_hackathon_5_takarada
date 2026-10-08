import * as THREE from 'three';
import { roomPalette } from '../../domain/roomPalette';
import { characterTheme } from '../../domain/characterTheme';
import type { RoomDesign } from '../../domain/room';

// Abstract room accents inspired by the selected theme; no licensed artwork.
export function buildCharacterThemeDecor(design: RoomDesign): THREE.Group | undefined {
  const theme = characterTheme(design.characterThemeId);
  if (!theme || !design.room) return undefined;
  const group = new THREE.Group();
  group.name = `character-theme-${theme.id}`;
  const palette = roomPalette(design.roomPaletteId);
  const accent = palette?.accent ?? theme.accent;
  const secondary = palette?.secondary ?? theme.secondary;
  const addShape = (geometry: THREE.BufferGeometry, x: number, y: number, color = accent) => {
    const object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }));
    object.position.set(x, y, 0);
    group.add(object);
    return object;
  };
  const circle = (radius: number, x: number, y: number, color = accent) => addShape(new THREE.CircleGeometry(radius, 32), x, y, color);
  const star = (radius: number, x: number, y: number) => {
    const shape = new THREE.Shape();
    for (let point = 0; point < 10; point++) {
      const angle = Math.PI / 2 + point * Math.PI / 5;
      const distance = point % 2 ? radius * .45 : radius;
      const px = Math.cos(angle) * distance, py = Math.sin(angle) * distance;
      if (!point) shape.moveTo(px, py); else shape.lineTo(px, py);
    }
    shape.closePath();
    return addShape(new THREE.ShapeGeometry(shape), x, y);
  };
  const heart = (x: number, y: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -.15);
    shape.bezierCurveTo(-.32, .03, -.21, .3, 0, .14);
    shape.bezierCurveTo(.21, .3, .32, .03, 0, -.15);
    addShape(new THREE.ShapeGeometry(shape), x, y);
  };
  switch (theme.motif) {
    case 'paw':
      circle(.16, 0, -.09);
      for (const [x, y] of [[-.2, .07], [-.075, .2], [.075, .2], [.2, .07]]) circle(.065, x, y);
      break;
    case 'music':
      for (const x of [-.23, .23]) {
        circle(.075, x - .06, -.12);
        addShape(new THREE.PlaneGeometry(.025, .3), x, 0);
        addShape(new THREE.PlaneGeometry(.12, .045), x + .05, .14);
      }
      break;
    case 'stars': star(.17, -.35, .07); heart(0, 0); star(.13, .35, -.02); break;
    case 'bow':
      for (const x of [-.17, .17]) circle(.18, x, 0);
      circle(.11, 0, 0, secondary);
      break;
    case 'hearts': heart(-.25, .02); heart(.25, .02); break;
    case 'star': star(.25, 0, 0); star(.1, -.4, -.12); star(.1, .4, .12); break;
    case 'cloud':
      for (const [x, y, radius] of [[-.22, 0, .16], [0, .08, .22], [.22, 0, .16]]) circle(radius, x, y);
      addShape(new THREE.PlaneGeometry(.44, .18), 0, -.065);
      break;
    case 'pudding':
      addShape(new THREE.CircleGeometry(.23, 32, 0, Math.PI), 0, -.08, secondary);
      addShape(new THREE.PlaneGeometry(.3, .16), 0, 0, secondary);
      addShape(new THREE.PlaneGeometry(.31, .035), 0, .1);
      circle(.04, 0, .15);
      break;
  }
  const { width, depth, height } = design.room;
  group.position.set(0, Math.min(1.65, height - .35), -depth / 2 + .04);
  // Keep motifs inside even the narrowest supported room.
  const scale = Math.min(1, width / 1.6, height / 2.4);
  group.scale.setScalar(scale);
  return group;
}
