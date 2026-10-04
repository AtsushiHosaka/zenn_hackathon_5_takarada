import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useLogin, useSession, useSignup } from '../../core/session';
import ErrorText from '../shared/ErrorText';
import ReferenceSvg from '../room/ReferenceSvg';
import './auth-reference.css';

function AuthHero({ signup }: { signup: boolean }) {
  const page = signup ? 1 : 0;
  return <section className="reference-auth-hero">
    <div className="reference-auth-brand">
      <ReferenceSvg page={page} index={0} />
      <span>Room Coordinator</span><span className="reference-auth-ai">AI</span>
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
  const mode = useLocation().pathname === '/signup' ? 'signup' : 'login';
  const isSignup = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<'password' | 'terms' | 'privacy' | null>(null);
  const login = useLogin();
  const signup = useSignup();
  const pending = login.isPending || signup.isPending;
  const error = isSignup ? signup.error : login.error;
  if (session.status === 'authenticated') return <Navigate to="/rooms" replace />;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isSignup) signup.mutate({ name, email, password });
    else login.mutate({ email, password });
  };
  const openNotice = (event: React.MouseEvent, kind: 'password' | 'terms' | 'privacy') => { event.preventDefault(); setNotice(kind); };
  const resetAuth = () => { login.reset(); signup.reset(); };
  const id = isSignup ? 'su' : 'login';
  return <main className="reference-auth">
    <AuthHero signup={isSignup} />
    <section className="reference-auth-form-section">
      <div className="reference-auth-form-container">
        <div className="reference-auth-heading"><h1>{isSignup ? 'アカウントを作成' : 'おかえりなさい'}</h1><p>{isSignup ? 'メールアドレスで登録できます。' : 'ルームの続きから始めましょう。'}</p></div>
        <form className="reference-auth-form" onSubmit={submit}>
          {isSignup && <div className="reference-auth-field"><label htmlFor="su-name">ニックネーム</label><input id="su-name" type="text" autoComplete="nickname" placeholder="ルームに表示される名前" value={name} onChange={(event) => setName(event.target.value)} required maxLength={50} /></div>}
          <div className="reference-auth-field"><label htmlFor={`${id}-email`}>メールアドレス</label><input id={`${id}-email`} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <div className="reference-auth-field">
            {isSignup ? <label htmlFor="su-password">パスワード</label> : <div className="reference-auth-password-label"><label htmlFor="login-password">パスワード</label><a href="#password" onClick={(event) => openNotice(event, 'password')}>パスワードを忘れた場合</a></div>}
            <div className="reference-auth-password"><input id={`${id}-password`} type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="パスワード" aria-describedby={isSignup ? 'su-password-hint' : undefined} value={password} onChange={(event) => setPassword(event.target.value)} minLength={isSignup ? 8 : undefined} required /><button type="button" aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}><ReferenceSvg page={isSignup ? 1 : 0} index={isSignup ? 2 : 4} /></button></div>
            {isSignup && <span id="su-password-hint" className="reference-auth-hint">8文字以上で入力してください</span>}
          </div>
          {isSignup && <label className="reference-auth-terms" htmlFor="su-terms"><input id="su-terms" type="checkbox" required /><span><a href="#terms" onClick={(event) => openNotice(event, 'terms')}>利用規約</a>と<a href="#privacy" onClick={(event) => openNotice(event, 'privacy')}>プライバシーポリシー</a>に同意します</span></label>}
          {error && <ErrorText error={error} />}
          <button className="reference-auth-primary" type="submit" disabled={pending}>{pending ? '送信しています…' : isSignup ? '登録してはじめる' : 'ログイン'}</button>
        </form>
        {isSignup ? <p className="reference-auth-existing"><span>すでにアカウントをお持ちの方</span><Link to="/login" onClick={resetAuth}>ログイン</Link></p> : <>
          <div className="reference-auth-divider"><span /><span>はじめての方</span><span /></div>
          <Link className="reference-auth-secondary" to="/signup" onClick={resetAuth}>アカウントを作成</Link>
          <div className="reference-auth-legal"><a href="#terms" onClick={(event) => openNotice(event, 'terms')}>利用規約</a><a href="#privacy" onClick={(event) => openNotice(event, 'privacy')}>プライバシーポリシー</a></div>
        </>}
      </div>
    </section>
    {notice && <div className="reference-auth-modal-backdrop" onClick={() => setNotice(null)}><section className="reference-auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-notice-title" onClick={(event) => event.stopPropagation()}><h2 id="auth-notice-title">{notice === 'password' ? 'パスワードの再設定' : notice === 'terms' ? '利用規約' : 'プライバシーポリシー'}</h2><p>{notice === 'password' ? 'パスワードを再設定する機能は準備中です。' : '正式な文書は準備中です。'}</p><button className="reference-auth-primary" type="button" autoFocus onClick={() => setNotice(null)}>閉じる</button></section></div>}
  </main>;
}
