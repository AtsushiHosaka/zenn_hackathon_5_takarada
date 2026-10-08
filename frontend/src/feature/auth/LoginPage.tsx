import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useLogin, useSession, useSignup } from '../../core/session';
import ErrorText from '../shared/ErrorText';
import ReferenceSvg from '../room/ReferenceSvg';
import ConnectionSwitch from '../shared/ConnectionSwitch';
import './auth-reference.css';

function AuthHero({ signup }: { signup: boolean }) {
  const page = signup ? 1 : 0;
  return <section className="reference-auth-hero">
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const noticeDialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState<'password' | 'terms' | 'privacy' | null>(null);
  const login = useLogin();
  const signup = useSignup();
  const pending = login.isPending || signup.isPending;
  const error = isSignup ? signup.error : login.error;
  useEffect(() => { if (notice) noticeDialog.current?.showModal(); else noticeDialog.current?.close(); }, [notice]);
  if (session.status === 'authenticated') return <Navigate to={destination} replace />;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || session.status === 'loading') return;
    if (isSignup && !name.trim()) { setValidation('ニックネームを入力してください'); return; }
    if (isSignup && new TextEncoder().encode(password).length > 72) { setValidation('パスワードはUTF-8で72バイト以内にしてください（半角英数字なら72文字以内）'); return; }
    setValidation(null);
    if (isSignup) signup.mutate({ name: name.trim(), email: email.trim(), password });
    else login.mutate({ email: email.trim(), password });
  };
  const openNotice = (event: React.MouseEvent, kind: 'password' | 'terms' | 'privacy') => { event.preventDefault(); setNotice(kind); };
  const resetAuth = () => { login.reset(); signup.reset(); setValidation(null); };
  const id = isSignup ? 'su' : 'login';
  return <main className="reference-auth">
    <AuthHero signup={isSignup} />
    <section className="reference-auth-form-section">
      <div className="reference-auth-form-container">
        <ConnectionSwitch />
        {session.status === 'loading' && <p role="status">ログイン状態を確認しています…</p>}
        {session.status === 'error' && <div><ErrorText error={session.error} /><button className="reference-auth-secondary" type="button" onClick={session.retry}>ログイン状態を再確認</button></div>}
        <div className="reference-auth-heading"><h1>{isSignup ? 'アカウントを作成' : 'おかえりなさい'}</h1></div>
        <form className="reference-auth-form" onSubmit={submit} aria-busy={pending}>
          {isSignup && <div className="reference-auth-field"><label htmlFor="su-name">ニックネーム</label><input id="su-name" type="text" autoComplete="nickname" placeholder="ルームに表示される名前" value={name} onChange={(event) => { setName(event.target.value); setValidation(null); signup.reset(); }} disabled={pending} required maxLength={50} /></div>}
          <div className="reference-auth-field"><label htmlFor={`${id}-email`}>メールアドレス</label><input id={`${id}-email`} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); resetAuth(); }} disabled={pending} required /></div>
          <div className="reference-auth-field">
            {isSignup ? <label htmlFor="su-password">パスワード</label> : <div className="reference-auth-password-label"><label htmlFor="login-password">パスワード</label><a href="#password" onClick={(event) => openNotice(event, 'password')}>パスワードを忘れた場合</a></div>}
            <div className="reference-auth-password"><input id={`${id}-password`} type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="パスワード" aria-describedby={isSignup ? 'su-password-hint' : undefined} value={password} onChange={(event) => { setPassword(event.target.value); resetAuth(); }} disabled={pending} minLength={isSignup ? 8 : undefined} maxLength={isSignup ? 72 : undefined} required /><button type="button" aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}><ReferenceSvg page={isSignup ? 1 : 0} index={isSignup ? 2 : 4} /></button></div>
            {isSignup && <span id="su-password-hint" className="reference-auth-hint">8文字以上、半角英数字なら72文字以内で入力してください</span>}
          </div>
          {isSignup && <label className="reference-auth-terms" htmlFor="su-terms"><input id="su-terms" type="checkbox" required /><span><a href="#terms" onClick={(event) => openNotice(event, 'terms')}>利用規約</a>と<a href="#privacy" onClick={(event) => openNotice(event, 'privacy')}>プライバシーポリシー</a>に同意します</span></label>}
          {validation && <p role="alert" className="reference-auth-error">{validation}</p>}
          {error && <ErrorText error={error} />}
          <button className="reference-auth-primary" type="submit" disabled={pending || session.status === 'loading'}>{pending ? '送信しています…' : isSignup ? '登録してはじめる' : 'ログイン'}</button>
        </form>
        {isSignup ? <p className="reference-auth-existing"><span>すでにアカウントをお持ちの方</span><Link to="/login" state={{ from: destination }} onClick={resetAuth}>ログイン</Link></p> : <>
          <div className="reference-auth-divider"><span /><span>はじめての方</span><span /></div>
          <Link className="reference-auth-secondary" to="/signup" state={{ from: destination }} onClick={resetAuth}>アカウントを作成</Link>
          <div className="reference-auth-legal"><a href="#terms" onClick={(event) => openNotice(event, 'terms')}>利用規約</a><a href="#privacy" onClick={(event) => openNotice(event, 'privacy')}>プライバシーポリシー</a></div>
        </>}
      </div>
    </section>
    <dialog ref={noticeDialog} className="reference-auth-modal" aria-labelledby="auth-notice-title" onCancel={() => setNotice(null)} onClick={(event) => { if (event.target === event.currentTarget) setNotice(null); }}><div className="reference-auth-modal-content"><h2 id="auth-notice-title">{notice === 'password' ? 'パスワードの再設定' : notice === 'terms' ? '利用規約' : 'プライバシーポリシー'}</h2><p>{notice === 'password' ? '現在、パスワードを再設定する機能は提供されていません。' : '正式な文書は準備中です。'}</p><button className="reference-auth-primary" type="button" autoFocus onClick={() => setNotice(null)}>閉じる</button></div></dialog>
  </main>;
}
