// シーンのレスポンス (snake_case) を Domain の綴りに直す。形は OpenAPI の生成物をそのまま使う。
import type { components } from "../generated/api";
import type { Scene, SceneObject } from "../../domain/scene";

export type SceneRecord = components["schemas"]["Scene"];
type SceneObjectRecord = components["schemas"]["SceneObject"];

export function toScene(record: SceneRecord): Scene {
  const { room } = record;
  return {
    room: {
      width: room.width,
      depth: room.depth,
      height: room.height,
      wallColor: room.wall_color,
      floorColor: room.floor_color,
      windows: room.windows.map((window) => ({ ...window })),
    },
    objects: record.objects.map(toSceneObject),
  };
}

function toSceneObject(record: SceneObjectRecord): SceneObject {
  return {
    id: record.id,
    source: record.source,
    category: record.category,
    label: record.label,
    size: { ...record.size },
    position: { ...record.position },
    rotationY: record.rotation_y,
    color: record.color,
    modelUrl: record.model_url,
    slot: record.slot,
    attachTo: record.attach_to,
    itemId: record.item_id,
    marker: record.marker,
  };
}
