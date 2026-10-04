import type { RoomItem } from '../../domain/room';
export function categoryOf(item:RoomItem):string {
  const category=item.category.toLowerCase();
  if(/led|lamp|light|照明/.test(category))return 'light';
  if(/shelf|storage|display|収納/.test(category))return 'storage';
  if(/rug|cushion|cover|curtain|fabric|ラグ|ファブリック/.test(category))return 'fabric';
  return 'goods';
}
