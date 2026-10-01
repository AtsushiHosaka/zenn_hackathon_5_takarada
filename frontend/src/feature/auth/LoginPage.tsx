import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { useLogin, useSession, useSignup } from "../../core/session";
import ConnectionSwitch from "../shared/ConnectionSwitch";
import ErrorText from "../shared/ErrorText";

const field =
  "w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800";

export default function LoginPage() {
  const session = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  // 画面ローカルの状態は useState。ViewModel は作らない
  const [name, setName] = useState("");
  const [email, setEmail] = useState("user1@example.com");
  const [password, setPassword] = useState("password");

  const login = useLogin();
  const signup = useSignup();
  const pending = login.isPending || signup.isPending;
  const error = login.error ?? signup.error;

  if (session.status === "authenticated") return <Navigate to="/" replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "login") login.mutate({ email, password });
    else signup.mutate({ name, email, password });
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4 dark:bg-slate-950">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        <h1 className="text-lg font-semibold">{mode === "login" ? "ログイン" : "サインアップ"}</h1>

        {mode === "signup" && (
          <label className="block space-y-1 text-sm">
            <span>名前</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}

        <label className="block space-y-1 text-sm">
          <span>メールアドレス</span>
          <input
            className={field}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span>パスワード</span>
          <input
            className={field}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <ErrorText error={error} />

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-slate-900 px-3 py-2 text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {pending ? "送信中..." : mode === "login" ? "ログイン" : "登録する"}
        </button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm text-slate-500 underline dark:text-slate-400"
          >
            {mode === "login" ? "アカウントを作る" : "ログインに戻る"}
          </button>
          <ConnectionSwitch />
        </div>
      </form>
    </div>
  );
}
