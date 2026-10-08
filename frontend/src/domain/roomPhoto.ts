// Keep aligned with backend/app/services/room_photo.rb.
export const roomPhotoMaxBytes = 10 * 1024 * 1024;
export const roomPhotoMaxCount = 4;
export const roomPhotoContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const roomPhotoLimitText = "JPEG・PNG・WebP、1枚10MiB（10,485,760バイト）まで、最大4枚";

export function roomPhotoError(photo: Pick<File, "name" | "type" | "size">): string | undefined {
  if (photo.size === 0) return `${photo.name}は空の画像です。別の画像を選んでください。`;
  if (!roomPhotoContentTypes.some(type => type === photo.type)) return `${photo.name}は対応していない形式です。JPEG・PNG・WebPを選んでください。`;
  if (photo.size > roomPhotoMaxBytes) return `${photo.name}は10MiBの上限を超えています。画像を小さくしてから追加してください。`;
}
