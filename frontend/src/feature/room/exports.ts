import type { RoomItem } from '../../domain/room';

// CSV は数式として解釈される文字を無害化してから、すべてのセルを引用する。
function csvCell(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function centimeters(meters: number): number {
  return Math.round(meters * 1000) / 10;
}

function productLink(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

/** 買い足す家具を、Excel でも読み込める UTF-8 CSV として保存する。 */
export function downloadShoppingCsv(items: RoomItem[], title: string): void {
  const rows: (string | number | undefined)[][] = [
    ['商品名', 'カテゴリ', '幅 (cm)', '高さ (cm)', '奥行き (cm)', '参考価格 (円)', 'ショップ', '商品リンク'],
    ...items.filter(item => !item.existing).map(item => [
      item.name,
      item.category,
      centimeters(item.size[0]),
      centimeters(item.size[1]),
      centimeters(item.size[2]),
      item.price,
      item.shop,
      productLink(item.productUrl),
    ]),
  ];
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  const filename = [...title].filter(character => character.charCodeAt(0) >= 32).join('')
    .replace(/[<>:"/\\|?*]/g, '').trim().slice(0, 80) || 'room';
  anchor.href = objectUrl;
  anchor.download = `${filename}-shopping.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // ダウンロードが URL を読み終える時間を確保する。
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
