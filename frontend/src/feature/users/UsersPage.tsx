import { Link } from "react-router";
import ErrorText from "../shared/ErrorText";
import { useUsers } from "./queries";

export default function UsersPage() {
  const users = useUsers();

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">ユーザー</h1>

      {users.isPending && <p className="text-slate-500">読み込み中...</p>}
      <ErrorText error={users.error} />

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {users.data?.map((user) => (
          <li key={user.id}>
            <Link
              to={`/users/${user.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>
                <span className="font-medium">{user.name}</span>
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{user.email}</span>
              </span>
              <span className="text-slate-400">›</span>
            </Link>
          </li>
        ))}
      </ul>

      {users.data?.length === 0 && <p className="text-slate-500">まだ誰もいません</p>}
    </section>
  );
}
