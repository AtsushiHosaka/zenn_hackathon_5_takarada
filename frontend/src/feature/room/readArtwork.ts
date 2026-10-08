import { MAX_ARTWORK_DATA_LENGTH, type ImageArtwork } from '../../domain/room';

export async function readArtwork(file: File): Promise<{ artwork: ImageArtwork; aspect: number }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPEG・PNG・WebPの画像を選んでください。');
  if (file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error('画像は1枚10MB以内にしてください。');
  const image = await createImageBitmap(file).catch(() => { throw new Error('画像を読み込めませんでした。別の画像を選んでください。'); });
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('この環境では画像を取り込めません。');
    for (const maximum of [512, 384, 256, 192, 128]) {
      const scale = Math.min(1, maximum / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl.length <= MAX_ARTWORK_DATA_LENGTH) return { artwork: { dataUrl }, aspect: image.width / image.height };
    }
    throw new Error('画像を保存できるサイズに変換できませんでした。別の画像を選んでください。');
  } finally { image.close(); }
}

