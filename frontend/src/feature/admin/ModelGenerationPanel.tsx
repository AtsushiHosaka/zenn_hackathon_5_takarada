// 商品の 3D モデルを AI に作らせる欄 (商品の編集欄の中)。作る → 確認用の画像と検査を見る → 採用か不採用かを選ぶ。
// 生成は数分かかる。生成中はほかの操作をしていてよく、この欄が 5 秒おきに状態を取り直す
import { useState } from "react";
import type { FurnitureSize, ModelGeneration } from "../../domain/furnitureAdmin";
import { toDomainError } from "../../domain/error";
import ModelPreview from "./ModelPreview";
import { useDecideModelGeneration, useModelGenerationFile, useModelGenerations, useStartModelGeneration } from "./queries";

const button = "motion-control rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50";
const primaryButton = "motion-control rounded bg-violet-700 px-3 py-1 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50";

const STATUS: Record<ModelGeneration["status"], { label: string; tone: string }> = {
  running: { label: "作っています…", tone: "bg-amber-100 text-amber-900" },
  succeeded: { label: "採用待ち", tone: "bg-emerald-100 text-emerald-900" },
  failed: { label: "失敗", tone: "bg-red-100 text-red-800" },
  adopted: { label: "採用済み", tone: "bg-violet-100 text-violet-900" },
  rejected: { label: "不採用", tone: "bg-slate-200 text-slate-700" },
};

export default function ModelGenerationPanel({ detailId, size, color }: { detailId: number; size: FurnitureSize; color: string }) {
  const generations = useModelGenerations(detailId);
  const start = useStartModelGeneration(detailId);
  const running = generations.data?.some((generation) => generation.status === "running") ?? false;
  // 新しい順。終わった古い記録は畳んでおく
  const [showAll, setShowAll] = useState(false);
  const list = generations.data ?? [];
  const visible = showAll ? list : list.slice(0, 2);

  return <section className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3" aria-label="AIで3Dモデルを作る">
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold">AIで3Dモデルを作る</h3>
      <button type="button" className={`${button} ml-auto`} disabled={running || start.isPending} onClick={() => start.mutate()}>
        {running ? "作っています…" : list.length ? "もう一度作る" : "作る"}
      </button>
    </div>
    <p className="text-xs text-slate-500">保存済みの商品画像・寸法・色から、この商品に似た形を作ります。4〜5分かかります。出来たら画像を見て、採用するかを決めてください。編集中の内容は、保存してから作ると反映されます。</p>
    {start.error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{toDomainError(start.error).message}</p>}
    {generations.isError && <p role="alert" className="text-sm text-red-700">{toDomainError(generations.error).message}</p>}
    {visible.map((generation) => <Generation key={generation.id} generation={generation} detailId={detailId} size={size} color={color} />)}
    {list.length > 2 && <button type="button" className="text-xs text-violet-700" onClick={() => setShowAll(!showAll)}>{showAll ? "古い記録を畳む" : `古い記録も見る（あと${list.length - 2}件）`}</button>}
  </section>;
}

function Generation({ generation, detailId, size, color }: { generation: ModelGeneration; detailId: number; size: FurnitureSize; color: string }) {
  const decide = useDecideModelGeneration(detailId);
  const [spin, setSpin] = useState(false);
  const hasFiles = generation.files.length > 0;
  const front = useModelGenerationFile(generation.id, "front.png", hasFiles);
  const side = useModelGenerationFile(generation.id, "side.png", hasFiles);
  const glb = useModelGenerationFile(generation.id, "model.glb", hasFiles && spin);
  const failed = generation.checks.filter((check) => !check.ok);
  const status = STATUS[generation.status];
  const minutes = generation.finishedAt ? Math.max(1, Math.round((generation.finishedAt.getTime() - generation.createdAt.getTime()) / 60000)) : null;

  return <article className="space-y-2 rounded border border-slate-200 bg-white p-2 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <span role="status" className={`rounded px-1.5 py-0.5 text-xs ${status.tone}`}>{status.label}</span>
      <span className="text-xs text-slate-500">{generation.createdAt.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}{minutes !== null && `・約${minutes}分`}</span>
      {generation.stats && <span className="ml-auto text-xs text-slate-500">三角形 {generation.stats.triangles.toLocaleString()}・{Math.round(generation.stats.bytes / 1024)}KB・部位 {generation.stats.materials.join(", ")}</span>}
    </div>
    {hasFiles && <div className="grid grid-cols-2 gap-2">
      {[front, side].map((file, index) => file.data
        ? <img key={index} src={file.data} alt={index === 0 ? "正面斜めから見た画像" : "横から見た画像"} className="aspect-square w-full rounded border border-slate-200 object-cover" />
        : <div key={index} className="aspect-square w-full rounded border border-slate-200 bg-slate-100" />)}
    </div>}
    {hasFiles && (spin
      ? glb.data ? <ModelPreview modelUrl={glb.data} size={generation.stats?.size ?? size} colors={{}} fallbackColor={color} /> : <p className="text-xs text-slate-500">3Dを読み込み中…</p>
      : <button type="button" className="text-xs text-violet-700" onClick={() => setSpin(true)}>3Dで回して見る</button>)}
    {generation.notes && <p className="text-xs text-slate-600">AIのメモ: {generation.notes}</p>}
    {generation.errorMessage && <p role="alert" className="whitespace-pre-wrap rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{generation.errorMessage}</p>}
    {generation.checks.length > 0 && <details className="text-xs text-slate-600">
      <summary>検査 {generation.checks.length - failed.length}/{generation.checks.length} 合格</summary>
      <ul className="mt-1 space-y-0.5">{generation.checks.map((check) => <li key={check.name} className={check.ok ? "" : "text-red-700"}>{check.ok ? "○" : "×"} {check.detail}</li>)}</ul>
    </details>}
    {generation.status === "succeeded" && <div className="flex gap-2">
      <button type="button" className={primaryButton} disabled={decide.isPending} onClick={() => decide.mutate({ id: generation.id, adopt: true })}>{decide.isPending ? "処理中…" : "この形を採用する"}</button>
      <button type="button" className={button} disabled={decide.isPending} onClick={() => decide.mutate({ id: generation.id, adopt: false })}>不採用</button>
    </div>}
    {generation.status === "succeeded" && <p className="text-xs text-slate-500">採用すると、この商品の3Dモデルがすぐに切り替わります（提案・検索・部屋の画面にも反映）。色は代表色で塗り直されます。</p>}
    {decide.error && <p role="alert" className="text-xs text-red-700">{toDomainError(decide.error).message}</p>}
  </article>;
}
