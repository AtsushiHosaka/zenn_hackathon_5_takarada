import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { appConfig } from '../../core/config';
import { loadConnection, saveConnection, type Connection } from '../../core/connection';
import { useSession, useLogout } from '../../core/session';
import ReferenceSvg from './ReferenceSvg';
import ErrorText from '../shared/ErrorText';
import { useMotionDialog } from '../shared/useMotionDialog';

export default function AccountMenu({ onEditLayout }: { onEditLayout?: () => void }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialog = useMotionDialog(dialogRef, open, () => setOpen(false));
  const session = useSession();
  const logout = useLogout();
  return <>
    <button className="rc-account" type="button" aria-label="アカウントメニュー" onClick={() => setOpen(true)}><ReferenceSvg page={2} index={1} /></button>
    <dialog ref={dialogRef} className="rc-dialog motion-dialog motion-presence" data-motion-state={dialog.state} tabIndex={-1} aria-labelledby="account-menu-title" onKeyDown={dialog.onKeyDown} onCancel={dialog.onCancel} onClose={dialog.onClose} onClick={dialog.onClick}>
      <div inert={dialog.closing} aria-hidden={dialog.closing}>
      <div className="rc-dialog-heading"><h2 id="account-menu-title">アカウント・接続設定</h2><button type="button" aria-label="閉じる" onClick={() => setOpen(false)}>×</button></div>
      {(session.status === 'guest' || session.user) && <p>{session.user ? `${session.user.name}さん` : 'ゲストとして閲覧しています。'}</p>}
      {session.status === 'loading' ? <p className="motion-fade" role="status">ログイン状態を確認しています…</p> : session.status === 'error' ? <><ErrorText error={session.error} /><button className="rc-secondary" type="button" onClick={session.retry}>再試行</button></> : session.user ? <><Link className="rc-primary" to="/account" onClick={() => setOpen(false)}>アカウント設定</Link><button className="rc-secondary" type="button" disabled={logout.isPending} onClick={() => logout.mutate()}>{logout.isPending ? 'ログアウトしています…' : 'ログアウト'}</button></> : <Link className="rc-primary" to="/login" onClick={() => setOpen(false)}>ログイン / アカウント作成</Link>}
      <ErrorText error={logout.error} />
      {onEditLayout && <p><button className="rc-secondary" type="button" onClick={() => { setOpen(false); onEditLayout(); }}>家具の配置・色を編集</button></p>}
      {appConfig.isDevelopment && <label className="rc-setting">開発時の接続先<select className="motion-field" value={loadConnection()} onChange={(event) => saveConnection(event.target.value as Connection)}><option value="dummy">モック（このブラウザ）</option><option value="api">API</option></select></label>}
      {appConfig.isDevelopment && <a href={`${appConfig.apiEndpoint}/api-docs/index.html`} target="_blank" rel="noopener noreferrer">API仕様を見る ↗</a>}
      </div>
    </dialog>
  </>;
}
