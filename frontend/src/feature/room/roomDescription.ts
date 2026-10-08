// Older saved plans include these generated notices after the actual response.
const noticeStarts = [
  /商品情報は(?:\d{4}年\d{1,2}月\d{1,2}日時点の参考値|静的な参考データ)です。/,
  /ECで確認した商品の参考価格です。/,
  /価格・在庫・仕様は(?:購入先|リンク先)でご確認ください。/,
  /3Dの形・色・寸法(?:・数量)?は近似(?:です|で)/,
];

export function roomDescription(description: string): string {
  const starts = noticeStarts.map(pattern => description.search(pattern)).filter(index => index >= 0);
  return description.slice(0, starts.length ? Math.min(...starts) : undefined).trimEnd();
}
