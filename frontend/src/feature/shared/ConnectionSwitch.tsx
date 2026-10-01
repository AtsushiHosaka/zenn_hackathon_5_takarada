import { connectionLabels, connections, loadConnection, saveConnection } from "../../core/connection";
import type { Connection } from "../../core/connection";

// 接続先の切り替え。ダミーなら backend を立てずに一通り動く。
// 本番ビルドでは出さない (開発中だけの道具)
export default function ConnectionSwitch() {
  if (!import.meta.env.DEV) return null;
  const current = loadConnection();

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      接続先
      <select
        value={current}
        onChange={(event) => saveConnection(event.target.value as Connection)}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      >
        {connections.map((connection) => (
          <option key={connection} value={connection}>
            {connectionLabels[connection]}
          </option>
        ))}
      </select>
    </label>
  );
}
