// Keep these rules aligned with backend/app/services/room_photo.rb.
export const roomPhotoLimits = {
  maxBytes: 10 * 1024 * 1024,
  maxCount: 4,
  contentTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

export const roomPhotoRequirements = "JPG・PNG・WebP、1枚10MB（10,485,760バイト）以内、最大4枚。";

export function roomPhotoValidationError(photo: Pick<File, "name" | "size" | "type">): string | undefined {
  if (photo.size === 0) return `「${photo.name}」は空のファイルです。別の画像を選んでください。`;
  if (photo.size > roomPhotoLimits.maxBytes) return `「${photo.name}」は容量の上限を超えています。写真は1枚10MB（10,485,760バイト）以内にしてください。`;
  if (!roomPhotoLimits.contentTypes.some(type => type === photo.type)) return `「${photo.name}」は対応していない画像形式です。JPG・PNG・WebPを選んでください。`;
  return undefined;
}
