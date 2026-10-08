import { Link, Outlet } from "react-router";
import { useLogout, useSession } from "../../core/session";
import ConnectionSwitch from "./ConnectionSwitch";

export default function AppLayout() {
  const session = useSession();
  const logout = useLogout();

  return (
    <div className="min-h-dvh bg-[#F5F4F8] text-[#1D1B26]">
      <header className="border-b border-[#E4E1EC] bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/rooms" className="motion-control font-semibold">
            へやいろ
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <ConnectionSwitch />
            <Link to="/rooms" className="motion-control text-sm text-violet-700">ルーム一覧</Link>
            {session.user && (
              <span className="text-sm text-slate-500 dark:text-slate-400">{session.user.name}</span>
            )}
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="motion-control rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
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
