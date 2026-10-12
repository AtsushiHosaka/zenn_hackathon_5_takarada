import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useSession } from "../../core/session";
import type { User } from "../../domain/user";
import ErrorText from "../shared/ErrorText";
import { useMotionPresence } from "../shared/useMotionPresence";
import { useDeleteUser, useUpdateUser } from "./queries";
import "./account.css";

export default function UserDetailPage() {
  const session = useSession();
  const { id } = useParams();
  if (session.status !== "authenticated") return null;
  if (id && Number(id) !== session.user.id) {
    return <section className="account-page motion-enter"><h1>このアカウントは表示できません</h1><Link to="/account">自分のアカウントへ戻る</Link></section>;
  }
  return <AccountForm key={session.user.id} user={session.user} />;
}

function AccountForm({ user }: { user: User }) {
  const update = useUpdateUser(user.id);
  const remove = useDeleteUser();
  const [name, setName] = useState(user.name);
  const [confirming, setConfirming] = useState(false);
  const confirmationPresence = useMotionPresence(confirming);
  const confirmationTrigger = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const dangerSection = useRef<HTMLElement>(null);
  const restoreConfirmationFocus = useRef(false);
  useLayoutEffect(() => {
    if (confirming) cancelButton.current?.focus({ preventScroll: true });
    else if (confirmationPresence.isPresent) dangerSection.current?.focus({ preventScroll: true });
    else if (restoreConfirmationFocus.current) {
      confirmationTrigger.current?.focus({ preventScroll: true });
      restoreConfirmationFocus.current = false;
    }
  }, [confirming, confirmationPresence.isPresent]);
  const [validation, setValidation] = useState<string | null>(null);
  const busy = update.isPending || remove.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const normalized = name.trim();
    if (!normalized) { setValidation("ニックネームを入力してください"); return; }
    setValidation(null);
    update.mutate({ name: normalized });
  };
  const cancelConfirmation = () => {
    if (busy) return;
    restoreConfirmationFocus.current = true;
    setConfirming(false);
    remove.reset();
  };
  return <section className="account-page motion-enter">
    <Link className="account-back" to="/rooms">← ルーム一覧へ戻る</Link>
    <div className="account-heading"><h1>アカウント設定</h1></div>
    <form className="account-card" aria-busy={busy} onSubmit={submit}>
      <h2>プロフィール</h2>
      <label className="account-field" htmlFor="account-email"><span>メールアドレス</span><input className="motion-field" id="account-email" type="email" value={user.email} readOnly autoComplete="email" /><small>登録済みのメールアドレスです。</small></label>
      <label className="account-field" htmlFor="account-name"><span>ニックネーム</span><input className="motion-field" id="account-name" value={name} onChange={(event) => { setName(event.target.value); setValidation(null); update.reset(); }} required maxLength={50} autoComplete="nickname" disabled={busy} /><small>50文字以内で入力してください。</small></label>
      {validation && <p key={validation} className="account-error motion-fade" role="alert">{validation}</p>}
      <ErrorText error={update.error} />
      {update.isSuccess && <p className="account-success motion-fade" role="status">プロフィールを保存しました。</p>}
      <button className="account-primary motion-control" type="submit" disabled={busy || name.trim() === user.name || !name.trim()}>{update.isPending ? "保存しています…" : "変更を保存"}</button>
    </form>
    <section ref={dangerSection} tabIndex={-1} className="account-card account-danger" aria-labelledby="account-delete-title" onKeyDown={event => { if (event.key === "Escape" && confirming && !busy) { event.preventDefault(); cancelConfirmation(); } }}>
      <h2 id="account-delete-title">退会</h2><p>アカウントを削除すると、同じアカウントではログインできなくなります。この操作は取り消せません。</p>
      <ErrorText error={remove.error} />
      {confirmationPresence.isPresent ? <div className="account-confirmation motion-presence" data-motion-state={confirmationPresence.state} inert={!confirming} aria-hidden={!confirming}><p>「{user.name}」のアカウントを削除しますか？</p><div className="account-actions"><button className="account-delete motion-control" type="button" disabled={busy || !confirming} onClick={() => { if (confirming && !busy) remove.mutate(user.id); }}>{remove.isPending ? "削除しています…" : "アカウントを削除する"}</button><button ref={cancelButton} className="account-secondary motion-control" type="button" disabled={busy || !confirming} onClick={cancelConfirmation}>キャンセル</button></div></div> : <button ref={confirmationTrigger} className="account-delete motion-control" type="button" disabled={busy} onClick={() => setConfirming(true)}>退会手続きへ</button>}
    </section>
  </section>;
}
