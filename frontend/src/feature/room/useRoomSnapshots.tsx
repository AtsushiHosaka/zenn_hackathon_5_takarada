import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { RoomDesign } from '../../domain/room';
import { readSnapshot, snapshotFingerprint, writeSnapshot } from './roomSnapshots';
import RoomSnapshotStudio from './RoomSnapshotStudio';

// 部屋ごとの写真を返す。まだ無い部屋は、画面の外で3Dモデルを1つずつ描いて撮る。
// 写真: 文字列 / 撮れなかった: null / 準備中: undefined
export function useRoomSnapshots(designs: RoomDesign[], scope: string): { snapshot: (design: RoomDesign) => string | null | undefined; studio: ReactNode } {
  const entries = designs.map(design => {
    const key = `${scope}:${design.id}`;
    const fingerprint = snapshotFingerprint(design);
    return { design, key, fingerprint, token: `${key}#${fingerprint}` };
  });
  const [shots, setShots] = useState<Record<string, string | null>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const looked = useRef(new Set<string>());
  const tokens = entries.map(entry => entry.token).join('\n');
  useEffect(() => {
    for (const entry of entries) {
      if (looked.current.has(entry.token)) continue;
      looked.current.add(entry.token);
      void readSnapshot(entry.key, entry.fingerprint).then(dataUrl => {
        if (dataUrl) setShots(previous => ({ ...previous, [entry.token]: dataUrl }));
        else setMissing(previous => [...previous, entry.token]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries は tokens が同じなら同じ内容
  }, [tokens]);
  const next = entries.find(entry => missing.includes(entry.token) && shots[entry.token] === undefined);
  const studio = next && <RoomSnapshotStudio key={next.token} design={next.design}
    onSnapshot={dataUrl => { setShots(previous => ({ ...previous, [next.token]: dataUrl })); void writeSnapshot(next.key, next.fingerprint, dataUrl); }}
    onReady={() => setShots(previous => previous[next.token] === undefined ? { ...previous, [next.token]: null } : previous)}/>;
  return { snapshot: design => shots[`${scope}:${design.id}#${snapshotFingerprint(design)}`], studio };
}
