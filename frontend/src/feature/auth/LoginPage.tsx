import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useLogin, useSession, useSignup } from '../../core/session';
import { appConfig } from '../../core/config';
import { loadConnection } from '../../core/connection';
import ErrorText from '../shared/ErrorText';
import { useMotionDialog } from '../shared/useMotionDialog';
import ReferenceSvg from '../room/ReferenceSvg';
import ConnectionSwitch from '../shared/ConnectionSwitch';
import './auth-reference.css';

function AuthHero({ signup }: { signup: boolean }) {
  const page = signup ? 1 : 0;
  return <section className="reference-auth-hero motion-enter">
    <div className="reference-auth-brand">
      <ReferenceSvg page={page} index={0} />
      <span>へやいろ</span><span className="reference-auth-ai">AI</span>
    </div>
    <div className={`reference-auth-illustration${signup ? ' reference-auth-illustration-signup' : ''}`}>
      <ReferenceSvg page={page} index={1} />
      <div className="reference-auth-prompt">{signup ? 'ボタニカルにしたい' : '紫色の推し活ルームにしたい'}</div>
      {!signup && <div className="reference-auth-item">
        <div className="reference-auth-item-image"><ReferenceSvg page={0} index={2} /></div>
        <div className="reference-auth-item-copy"><span>LEDテープライト 5m</span><span>¥2,980 · Shop A</span></div>
        <ReferenceSvg page={0} index={3} />
      </div>}
    </div>
    {signup ? <ol className="reference-auth-steps">
      <li><span>01</span><span>部屋の写真を<br />3〜4枚送る</span></li>
      <li><span>02</span><span>なりたい雰囲気を<br />ひとことで伝える</span></li>
      <li><span>03</span><span>3Dで確かめて<br />そのまま購入</span></li>
    </ol> : <div className="reference-auth-intro"><h2>部屋の写真と、ひとことで。</h2><p>今ある家具を活かしたレイアウトを3Dで提案し、買い足すアイテムのリンクまでまとめて届けます。</p></div>}
  </section>;
}

export default function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const mode = location.pathname === '/signup' ? 'signup' : 'login';
  const from: unknown = location.state?.from;
  const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !/^\/(login|signup)([/?#]|$)/.test(from) ? from : '/rooms/new';
  const isSignup = mode === 'signup';
  const isDummy = loadConnection() === 'dummy';
  const signupPaused = isSignup && !isDummy && (!appConfig.legal.termsUrl || !appConfig.legal.privacyUrl);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [notice, setNotice] = useState<'password' | 'terms' | 'privacy'>('password');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const noticeDialogRef = useRef<HTMLDialogElement>(null);
  const noticeDialog = useMotionDialog(noticeDialogRef, noticeOpen, () => setNoticeOpen(false));
  const login = useLogin();
  const signup = useSignup();
  const pending = login.isPending || signup.isPending;
  const error = isSignup ? signup.error : login.error;
  if (session.status === 'authenticated') return <Navigate to={destination} replace />;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || session.status === 'loading' || signupPaused) return;
    if (isSignup && !name.trim()) { setValidation('ニックネームを入力してください'); return; }
    if (isSignup && new TextEncoder().encode(password).length > 72) { setValidation('パスワードはUTF-8で72バイト以内にしてください（半角英数字なら72文字以内）'); return; }
    setValidation(null);
    if (isSignup) signup.mutate({ name: name.trim(), email: email.trim(), password });
    else login.mutate({ email: email.trim(), password });
  };
  const openNotice = (event: React.MouseEvent, kind: 'password' | 'terms' | 'privacy') => { event.preventDefault(); setNotice(kind); setNoticeOpen(true); };
  const legalLink = (kind: 'terms' | 'privacy') => {
    const url = kind === 'terms' ? appConfig.legal.termsUrl : appConfig.legal.privacyUrl;
    return <a href={url || `#${kind}`} target={url ? '_blank' : undefined} rel={url ? 'noopener noreferrer' : undefined} onClick={(event) => { if (!url) openNotice(event, kind); }}>{kind === 'terms' ? '利用規約' : 'プライバシーポリシー'}</a>;
  };
  const resetAuth = () => { login.reset(); signup.reset(); setValidation(null); };
  const id = isSignup ? 'su' : 'login';
  return <main className="reference-auth">
    <AuthHero signup={isSignup} />
    <section className="reference-auth-form-section">
      <div className="reference-auth-form-container motion-enter">
        <ConnectionSwitch />
        {session.status === 'loading' && <p className="motion-fade" role="status">ログイン状態を確認しています…</p>}
        {session.status === 'error' && <div><ErrorText error={session.error} /><button className="reference-auth-secondary motion-control" type="button" onClick={session.retry}>ログイン状態を再確認</button></div>}
        <div className="reference-auth-heading"><h1>{isSignup ? 'アカウントを作成' : 'おかえりなさい'}</h1></div>
        {isSignup && isDummy && <p role="status" className="reference-auth-hint motion-fade">ダミーモードのデモ登録です。</p>}
        {signupPaused && <p role="alert" className="reference-auth-error motion-fade">利用規約とプライバシーポリシーを公開するまで、新規登録を停止しています。</p>}
        <form className="reference-auth-form" onSubmit={submit} aria-busy={pending}>
          {isSignup && <div className="reference-auth-field"><label htmlFor="su-name">ニックネーム</label><input className="motion-field" id="su-name" type="text" autoComplete="nickname" placeholder="ルームに表示される名前" value={name} onChange={(event) => { setName(event.target.value); setValidation(null); signup.reset(); }} disabled={pending || signupPaused} required maxLength={50} /></div>}
          <div className="reference-auth-field"><label htmlFor={`${id}-email`}>メールアドレス</label><input className="motion-field" id={`${id}-email`} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); resetAuth(); }} disabled={pending || signupPaused} required /></div>
          <div className="reference-auth-field">
            {isSignup ? <label htmlFor="su-password">パスワード</label> : <div className="reference-auth-password-label"><label htmlFor="login-password">パスワード</label><a href="#password" onClick={(event) => openNotice(event, 'password')}>パスワードを忘れた場合</a></div>}
            <div className="reference-auth-password"><input className="motion-field" id={`${id}-password`} type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="パスワード" aria-describedby={isSignup ? 'su-password-hint' : undefined} value={password} onChange={(event) => { setPassword(event.target.value); resetAuth(); }} disabled={pending || signupPaused} minLength={isSignup ? 8 : undefined} maxLength={isSignup ? 72 : undefined} required /><button className="motion-control" type="button" aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}><ReferenceSvg page={isSignup ? 1 : 0} index={isSignup ? 2 : 4} /></button></div>
            {isSignup && <span id="su-password-hint" className="reference-auth-hint">8文字以上、半角英数字なら72文字以内で入力してください</span>}
          </div>
          {isSignup && !isDummy && !signupPaused && <label className="reference-auth-terms" htmlFor="su-terms"><input className="motion-field" id="su-terms" type="checkbox" required /><span>{legalLink('terms')}と{legalLink('privacy')}に同意します</span></label>}
          {validation && <p key={validation} role="alert" className="reference-auth-error motion-fade">{validation}</p>}
          {error && <ErrorText error={error} />}
          <button className="reference-auth-primary motion-control" type="submit" disabled={pending || session.status === 'loading' || signupPaused}>{pending ? '送信しています…' : isSignup ? '登録してはじめる' : 'ログイン'}</button>
        </form>
        {isSignup ? <p className="reference-auth-existing"><span>すでにアカウントをお持ちの方</span><Link to="/login" state={{ from: destination }} onClick={resetAuth}>ログイン</Link></p> : <>
          <div className="reference-auth-divider"><span /><span>はじめての方</span><span /></div>
          <Link className="reference-auth-secondary motion-control" to="/signup" state={{ from: destination }} onClick={resetAuth}>アカウントを作成</Link>
          <div className="reference-auth-legal">{legalLink('terms')}{legalLink('privacy')}</div>
        </>}
      </div>
    </section>
    <dialog ref={noticeDialogRef} className="reference-auth-modal motion-dialog motion-presence" data-motion-state={noticeDialog.state} tabIndex={-1} aria-labelledby="auth-notice-title" onKeyDown={noticeDialog.onKeyDown} onCancel={noticeDialog.onCancel} onClose={noticeDialog.onClose} onClick={noticeDialog.onClick}><div className="reference-auth-modal-content" inert={noticeDialog.closing} aria-hidden={noticeDialog.closing}><h2 id="auth-notice-title">{notice === 'password' ? 'パスワードの再設定' : notice === 'terms' ? '利用規約' : 'プライバシーポリシー'}</h2><p>{notice === 'password' ? '現在、パスワードを再設定する機能は提供されていません。' : '正式な文書は準備中です。'}</p><button className="reference-auth-primary motion-control" type="button" autoFocus onClick={() => setNoticeOpen(false)}>閉じる</button></div></dialog>
  </main>;
}
