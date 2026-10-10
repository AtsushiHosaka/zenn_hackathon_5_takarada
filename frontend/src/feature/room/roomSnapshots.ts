import type { RoomDesign } from '../../domain/room';

// 部屋の3Dモデルを撮った写真を、このブラウザ (IndexedDB) に置く。
// 一覧で部屋の数だけ3Dを描かずに済ませるためで、消えても撮り直せる。
const DATABASE = 'room-coordinator.snapshots';
const STORE = 'snapshots';
type Entry = { fingerprint: string; dataUrl: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 部屋の内容が変わると別の値になり、古い写真を使わない。
export function snapshotFingerprint(design: RoomDesign): string {
  const text = JSON.stringify(design);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return `${text.length}-${(hash >>> 0).toString(16)}`;
}

export async function readSnapshot(key: string, fingerprint: string): Promise<string | undefined> {
  try {
    const database = await open();
    return await new Promise(resolve => {
      const request = database.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => {
        const entry = request.result as Entry | undefined;
        resolve(entry?.fingerprint === fingerprint ? entry.dataUrl : undefined);
      };
      request.onerror = () => resolve(undefined);
    });
  } catch { return undefined; }
}

export async function writeSnapshot(key: string, fingerprint: string, dataUrl: string): Promise<void> {
  try {
    const database = await open();
    database.transaction(STORE, 'readwrite').objectStore(STORE).put({ fingerprint, dataUrl } satisfies Entry, key);
  } catch { /* 保存できなくても、このタブでは撮った写真を使える。 */ }
}
