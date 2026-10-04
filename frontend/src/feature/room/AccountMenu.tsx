import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { appConfig } from '../../core/config';
import { loadConnection, saveConnection, type Connection } from '../../core/connection';
import { useRepositories } from '../../core/repositories';
import { useSession, useLogout } from '../../core/session';
import ReferenceSvg from './ReferenceSvg';
import { roomPlanKeys } from './plans';
import ErrorText from '../shared/ErrorText';

export default function AccountMenu({ onEditLayout }: { onEditLayout?: () => void }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const { rooms } = useRepositories();
  const capability = useQuery({ queryKey: roomPlanKeys.capabilities, queryFn: () => rooms.capabilities(), staleTime: Infinity });
  const session = useSession();
  const logout = useLogout();
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <>
    <button className="rc-account" type="button" aria-label="アカウントメニュー" onClick={() => setOpen(true)}><ReferenceSvg page={2} index={1} /></button>
    <dialog ref={dialog} className="rc-dialog" onCancel={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="rc-dialog-heading"><h2>アカウント・接続設定</h2><button type="button" aria-label="閉じる" onClick={() => setOpen(false)}>×</button></div>
      {(session.status === 'guest' || session.user) && <p>{session.user ? `${session.user.name}さん` : 'ゲストとして閲覧しています。'}</p>}
      {session.status === 'loading' ? <p role="status">ログイン状態を確認しています…</p> : session.status === 'error' ? <><ErrorText error={session.error} /><button className="rc-secondary" type="button" onClick={session.retry}>再試行</button></> : session.user ? <><Link className="rc-primary" to="/account" onClick={() => setOpen(false)}>アカウント設定</Link><button className="rc-secondary" type="button" disabled={logout.isPending} onClick={() => logout.mutate()}>{logout.isPending ? 'ログアウトしています…' : 'ログアウト'}</button></> : <Link className="rc-primary" to="/login" onClick={() => setOpen(false)}>ログイン / アカウント作成</Link>}
      <ErrorText error={logout.error} />
      {onEditLayout && <p><button className="rc-secondary" type="button" onClick={() => { setOpen(false); onEditLayout(); }}>家具の配置・色を編集</button></p>}
      {appConfig.isDevelopment && <label className="rc-setting">開発時の接続先<select value={loadConnection()} onChange={(event) => saveConnection(event.target.value as Connection)}><option value="dummy">モック（このブラウザ）</option><option value="api">API</option></select></label>}
      <p className="rc-setting-note">{capability.data?.message}</p>
      <ErrorText error={capability.error} />
      {appConfig.isDevelopment && <p className="rc-setting-note">API接続先<br /><code>{appConfig.apiEndpoint}</code></p>}
      {appConfig.isDevelopment && <a href={`${appConfig.apiEndpoint}/api-docs/index.html`} target="_blank" rel="noopener noreferrer">API仕様を見る ↗</a>}
    </dialog>
  </>;
}
