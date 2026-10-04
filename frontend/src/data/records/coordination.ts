import type { components } from "../generated/api";
import type { Coordination, CoordinationItem } from "../../domain/coordination";
import { toScene } from "./scene";

export type CoordinationRecord = components["schemas"]["Coordination"];
type CoordinationItemRecord = components["schemas"]["CoordinationItem"];

export function toCoordination(record: CoordinationRecord): Coordination {
  return {
    id: record.id,
    roomId: record.room_id,
    status: record.status,
    prompt: record.prompt,
    budget: record.budget,
    keptObjectIds: record.kept_object_ids,
    title: record.title,
    comment: record.comment,
    beforeScene: record.before_scene ? toScene(record.before_scene) : null,
    afterScene: record.after_scene ? toScene(record.after_scene) : null,
    items: record.items.map(toCoordinationItem),
    totalPrice: record.total_price,
    errorMessage: record.error_message,
    createdAt: new Date(record.created_at),
  };
}

function toCoordinationItem(record: CoordinationItemRecord): CoordinationItem {
  return {
    marker: record.marker,
    itemId: record.item_id,
    slot: record.slot,
    category: record.category,
    name: record.name,
    price: record.price,
    shop: record.shop,
    url: record.url,
    imageUrl: record.image_url,
    color: record.color,
    placementNote: record.placement_note,
  };
}
