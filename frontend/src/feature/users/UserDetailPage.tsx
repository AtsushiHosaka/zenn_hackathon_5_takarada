import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useSession } from "../../core/session";
import type { User } from "../../domain/user";
import ErrorText from "../shared/ErrorText";
import { useDeleteUser, useUpdateUser } from "./queries";
import "./account.css";

export default function UserDetailPage() {
  const session = useSession();
  const { id } = useParams();
  if (session.status !== "authenticated") return null;
  if (id && Number(id) !== session.user.id) {
    return <section className="account-page"><h1>このアカウントは表示できません</h1><Link to="/account">自分のアカウントへ戻る</Link></section>;
  }
  return <AccountForm key={session.user.id} user={session.user} />;
}

function AccountForm({ user }: { user: User }) {
  const update = useUpdateUser(user.id);
  const remove = useDeleteUser();
  const [name, setName] = useState(user.name);
  const [confirming, setConfirming] = useState(false);
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
  return <section className="account-page">
    <Link className="account-back" to="/rooms">← ルーム一覧へ戻る</Link>
    <div className="account-heading"><h1>アカウント設定</h1><p>ニックネームの変更と退会ができます。</p></div>
    <form className="account-card" onSubmit={submit}>
      <h2>プロフィール</h2>
      <label className="account-field" htmlFor="account-email"><span>メールアドレス</span><input id="account-email" type="email" value={user.email} readOnly autoComplete="email" /><small>登録済みのメールアドレスです。</small></label>
      <label className="account-field" htmlFor="account-name"><span>ニックネーム</span><input id="account-name" value={name} onChange={(event) => { setName(event.target.value); setValidation(null); update.reset(); }} required maxLength={50} autoComplete="nickname" disabled={busy} /><small>50文字以内で入力してください。</small></label>
      {validation && <p className="account-error" role="alert">{validation}</p>}
      <ErrorText error={update.error} />
      {update.isSuccess && <p className="account-success" role="status">プロフィールを保存しました。</p>}
      <button className="account-primary" type="submit" disabled={busy || name.trim() === user.name || !name.trim()}>{update.isPending ? "保存しています…" : "変更を保存"}</button>
    </form>
    <section className="account-card account-danger" aria-labelledby="account-delete-title">
      <h2 id="account-delete-title">退会</h2><p>アカウントを削除すると、同じアカウントではログインできなくなります。この操作は取り消せません。</p>
      <ErrorText error={remove.error} />
      {confirming ? <div className="account-confirmation"><p>「{user.name}」のアカウントを削除しますか？</p><div className="account-actions"><button className="account-delete" type="button" disabled={busy} onClick={() => { if (!busy) remove.mutate(user.id); }}>{remove.isPending ? "削除しています…" : "アカウントを削除する"}</button><button className="account-secondary" type="button" disabled={busy} onClick={() => { setConfirming(false); remove.reset(); }}>キャンセル</button></div></div> : <button className="account-delete" type="button" disabled={busy} onClick={() => setConfirming(true)}>退会手続きへ</button>}
    </section>
  </section>;
}
