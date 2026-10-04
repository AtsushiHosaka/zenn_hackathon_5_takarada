import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useSession } from "../../core/session";
import ErrorText from "./ErrorText";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.status === "loading") {
    return <div className="grid min-h-dvh place-items-center text-slate-500" role="status">ログイン状態を確認しています…</div>;
  }
  if (session.status === "error") {
    return <main className="mx-auto max-w-lg space-y-4 px-6 py-16"><h1 className="text-xl font-semibold">ログイン状態を確認できませんでした</h1><ErrorText error={session.error} /><button type="button" onClick={session.retry} className="rounded bg-violet-700 px-4 py-2 text-white">再試行</button></main>;
  }
  if (session.status === "guest") {
    return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;
  }
  return children;
}
