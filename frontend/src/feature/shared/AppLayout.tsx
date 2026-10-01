import { Link, Outlet } from "react-router";
import { useLogout, useSession } from "../../core/session";
import ConnectionSwitch from "./ConnectionSwitch";

export default function AppLayout() {
  const session = useSession();
  const logout = useLogout();

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="font-semibold">
            hack
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <ConnectionSwitch />
            {session.user && (
              <span className="text-sm text-slate-500 dark:text-slate-400">{session.user.name}</span>
            )}
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
