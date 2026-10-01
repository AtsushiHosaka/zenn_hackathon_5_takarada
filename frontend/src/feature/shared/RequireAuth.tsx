import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useSession } from "../../core/session";

// ログインしていない状態で入ってきたら /login に送る
export default function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();

  if (session.status === "loading") {
    return <div className="grid min-h-dvh place-items-center text-slate-500">読み込み中...</div>;
  }
  if (session.status === "guest") {
    return <Navigate to="/login" replace />;
  }
  return children;
}
