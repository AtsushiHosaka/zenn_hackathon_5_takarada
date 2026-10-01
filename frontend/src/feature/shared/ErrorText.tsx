import { toDomainError } from "../../domain/error";

// 失敗はここで表示を揃える。DomainError.message をそのまま出す。
export default function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="whitespace-pre-line rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {toDomainError(error).message}
    </p>
  );
}
