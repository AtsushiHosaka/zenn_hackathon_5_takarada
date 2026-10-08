import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DomainError } from '../../domain/error';
import { isManualFurniture, isRoomItem, type RoomItem } from '../../domain/room';
import { useSession } from '../../core/session';
import { useRoomPlanScope } from './plans';

const MAX_ITEMS = 30;
const MAX_STORAGE_LENGTH = 4 * 1024 * 1024;
const storageKey = (scope: string) => `room-coordinator.imported-furniture.v1:${scope}`;
const itemIdentity = (item: RoomItem) => item.ecProductId ? `ec:${item.ecProductId}` : item.id;

export function readImportedFurniture(scope: string): RoomItem[] {
  try {
    const serialized = localStorage.getItem(storageKey(scope));
    if (!serialized) return [];
    if (serialized.length > MAX_STORAGE_LENGTH) throw new Error();
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value) || value.length > MAX_ITEMS || !value.every(item => isRoomItem(item) && isManualFurniture(item))) throw new Error();
    if (new Set(value.map(itemIdentity)).size !== value.length) throw new Error();
    return value;
  } catch { throw new DomainError('取り込んだ家具を読み込めませんでした。保存データを確認してください。'); }
}

export function writeImportedFurniture(scope: string, items: RoomItem[]): void {
  if (items.length > MAX_ITEMS) throw new DomainError('保存できる家具は30点までです。不要な家具を一覧から削除してください。');
  if (new Set(items.map(itemIdentity)).size !== items.length || !items.every(item => isRoomItem(item) && isManualFurniture(item))) throw new DomainError('家具の情報が正しくありません。');
  const serialized = JSON.stringify(items);
  if (serialized.length > MAX_STORAGE_LENGTH) throw new DomainError('取り込んだ家具の保存容量を超えています。不要な家具を一覧から削除してください。');
  try { localStorage.setItem(storageKey(scope), serialized); }
  catch { throw new DomainError('取り込んだ家具を保存できませんでした。ブラウザの保存容量と設定を確認してください。'); }
}

export function useImportedFurniture() {
  const scope = useRoomPlanScope();
  const session = useSession();
  const client = useQueryClient();
  const key = ['room', scope, 'imported-furniture'] as const;
  const authenticated = session.status === 'authenticated';
  const query = useQuery({ queryKey: key, queryFn: () => readImportedFurniture(scope), enabled: authenticated, staleTime: Infinity, retry: false });
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === null || event.key === storageKey(scope))) void client.invalidateQueries({ queryKey: ['room', scope, 'imported-furniture'] });
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, [client, scope]);

  function update(transform: (previous: RoomItem[]) => RoomItem[]): void {
    if (!authenticated) throw new DomainError('取り込んだ家具を保存・検索するにはログインしてください。');
    const next = transform(readImportedFurniture(scope));
    writeImportedFurniture(scope, next);
    client.setQueryData(key, next);
  }
  return {
    ...query, scope, authenticated, data: authenticated ? query.data ?? [] : [],
    register: (item: RoomItem) => update(previous => [item, ...previous.filter(candidate => itemIdentity(candidate) !== itemIdentity(item))]),
    remove: (id: string) => update(previous => previous.filter(item => item.id !== id)),
  };
}
