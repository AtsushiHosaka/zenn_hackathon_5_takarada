import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { User } from "../../domain/user";
import ErrorText from "../shared/ErrorText";
import { useDeleteUser, useUpdateUser, useUser } from "./queries";

export default function UserDetailPage() {
  const { id } = useParams();
  const user = useUser(Number(id));

  if (user.isPending) return <p className="text-slate-500">読み込み中...</p>;
  if (user.error) return <ErrorText error={user.error} />;

  // 取得できてから中身を描く。フォームの初期値は useState に渡すだけで済み、
  // useEffect で state を同期する必要が無くなる (key で別ユーザーなら作り直し)
  return <UserForm key={user.data.id} user={user.data} />;
}

function UserForm({ user }: { user: User }) {
  const navigate = useNavigate();
  const update = useUpdateUser(user.id);
  const remove = useDeleteUser();

  const [name, setName] = useState(user.name);
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="space-y-6">
      <Link to="/" className="text-sm text-slate-500 underline dark:text-slate-400">
        ← 一覧
      </Link>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>

        <label className="block space-y-1 text-sm">
          <span>名前</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <ErrorText error={update.error ?? remove.error} />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update.mutate({ name })}
            disabled={update.isPending || name.trim() === ""}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {update.isPending ? "保存中..." : "保存"}
          </button>

          {/* confirm() はタブを固めるので使わず、2 段階のボタンにしている */}
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => remove.mutate(user.id, { onSuccess: () => navigate("/") })}
                disabled={remove.isPending}
                className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
              >
                本当に削除する
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded px-3 py-2 text-sm text-slate-500"
              >
                やめる
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="ml-auto rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
            >
              削除
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
