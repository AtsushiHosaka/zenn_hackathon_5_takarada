import { useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { Link } from "react-router";
import { useSession } from "../../core/session";
import type { AdminFurnitureDetail, AdminFurnitureDetailInput, AdminFurnitureModel, FurnitureAdminCatalog, FurnitureSize } from "../../domain/furnitureAdmin";
import ErrorText from "../shared/ErrorText";
import ModelPreview from "./ModelPreview";
import ModelThumbnail from "./ModelThumbnail";
import { useAdminFurnitureDetails, useAdminFurnitureModels, useDeleteFurnitureDetail, useExportFurnitureDetails, useSaveFurnitureDetail, useSetFurnitureModelEnabled } from "./queries";

const HEX = /^#[0-9a-f]{6}$/i;
const field = "motion-field w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm";
const button = "motion-control rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50";
const primaryButton = "motion-control rounded bg-violet-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50";

const centimeters = (meters: number) => String(Math.round(meters * 1000) / 10);
const sizeText = (size: FurnitureSize) => [size.w, size.h, size.d].map(centimeters).join(" × ");
const normalized = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja-JP");

// 幅が狭いと編集欄は一覧の上に出る。選んだ行が下のほうでも見えるよう、編集欄まで戻す
function revealPanel(panel: RefObject<HTMLElement | null>) {
  requestAnimationFrame(() => {
    const top = panel.current?.getBoundingClientRect().top;
    // 横に並んで貼り付いているとき (上端が画面内) は動かさない
    if (top !== undefined && (top < 0 || top > window.innerHeight / 2)) panel.current?.scrollIntoView({ block: "start" });
  });
}

// 家具・商品の管理画面。管理者 (User.admin) だけが使える (API 側でも 403 にしている)
export default function AdminPage() {
  const session = useSession();
  const [tab, setTab] = useState<"details" | "models">("details");
  if (session.status !== "authenticated") return null;
  if (!session.user.admin) {
    return <main className="mx-auto max-w-lg space-y-4 px-6 py-16"><h1 className="text-xl font-semibold">管理画面は管理者だけが使えます</h1><Link className="text-violet-700" to="/rooms">ルーム一覧へ戻る</Link></main>;
  }
  return <div className="min-h-dvh bg-[#F5F4F8] text-[#1D1B26]">
    <header className="border-b border-[#E4E1EC] bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <h1 className="font-semibold">家具・商品の管理</h1>
        <nav className="flex gap-1" aria-label="管理する対象">
          {([["details", "商品"], ["models", "3Dモデル"]] as const).map(([value, label]) =>
            <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`motion-control rounded px-3 py-1 text-sm ${tab === value ? "bg-violet-700 text-white" : "hover:bg-slate-100"}`}>{label}</button>)}
        </nav>
        <Link to="/rooms" className="motion-control ml-auto text-sm text-violet-700">ルーム一覧へ戻る</Link>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-6">{tab === "details" ? <DetailsTab /> : <ModelsTab />}</main>
  </div>;
}

function DetailsTab() {
  const catalog = useAdminFurnitureDetails();
  const models = useAdminFurnitureModels();
  if (catalog.isPending || models.isPending) return <p role="status" className="text-slate-500">読み込み中…</p>;
  if (catalog.error || models.error) return <ErrorText error={catalog.error ?? models.error} />;
  return <DetailsBoard catalog={catalog.data} models={models.data} />;
}

function DetailsBoard({ catalog, models }: { catalog: FurnitureAdminCatalog; models: AdminFurnitureModel[] }) {
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState("");
  const [state, setState] = useState<"" | "hidden" | "no_image">("");
  // 編集中の商品。"new" は新規作成、null は未選択
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const panel = useRef<HTMLElement>(null);
  const select = (next: number | "new") => { setSelected(next); revealPanel(panel); };
  const exporter = useExportFurnitureDetails();

  const terms = normalized(query).split(/\s+/).filter(Boolean);
  const details = catalog.details
    .filter((detail) => !slot || detail.slot === slot)
    .filter((detail) => state === "" || (state === "hidden" ? !detail.enabled : !detail.imageUrl))
    .filter((detail) => {
      const text = normalized([detail.name, detail.shop, detail.category, detail.key, detail.modelKey ?? "", detail.colorName ?? ""].join(" "));
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => a.slot.localeCompare(b.slot) || a.position - b.position || a.id - b.id);
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const editing = typeof selected === "number" ? catalog.details.find((detail) => detail.id === selected) ?? null : null;

  const download = () => exporter.mutate(undefined, {
    onSuccess: (data) => {
      const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "furniture_details.json";
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  return <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
    <section aria-label="商品の一覧" className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grow text-xs text-slate-600">検索<input className={field} type="search" placeholder="商品名・ショップ・種類・モデル" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="text-xs text-slate-600">置き場所の枠<select className={field} value={slot} onChange={(event) => setSlot(event.target.value)}><option value="">すべて</option>{catalog.slots.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-slate-600">状態<select className={field} value={state} onChange={(event) => setState(event.target.value as typeof state)}><option value="">すべて</option><option value="hidden">非表示</option><option value="no_image">画像なし</option></select></label>
        <button type="button" className={primaryButton} onClick={() => select("new")}>商品を追加</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span role="status">{details.length}件 / 全{catalog.details.length}件</span>
        <button type="button" className={button} disabled={exporter.isPending} onClick={download}>{exporter.isPending ? "書き出し中…" : "JSONを書き出す"}</button>
        <span>商品はDBが正です。書き出しは控えと、初期データ（backend/db/furniture_details.json）の更新に使えます。</span>
      </div>
      <ErrorText error={exporter.error} />
      <div className="overflow-x-auto rounded-lg border border-[#E4E1EC] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E4E1EC] text-xs text-slate-500"><tr><th className="px-2 py-2">画像</th><th className="px-2 py-2">3D</th><th className="px-2 py-2">商品</th><th className="px-2 py-2">枠・並び順</th><th className="px-2 py-2 text-right">価格</th><th className="px-2 py-2">リンク</th></tr></thead>
          <tbody>
            {details.map((detail) => <tr key={detail.id} aria-selected={selected === detail.id} onClick={() => select(detail.id)} className={`cursor-pointer border-b border-[#F0EEF5] last:border-0 hover:bg-violet-50 ${selected === detail.id ? "bg-violet-100" : ""} ${detail.enabled ? "" : "opacity-60"}`}>
              <td className="px-2 py-1.5">{detail.imageUrl
                ? <img src={detail.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-12 w-12 rounded object-cover" />
                : <span className="grid h-12 w-12 place-items-center rounded text-[10px] text-slate-500" style={{ backgroundColor: detail.symbolicColor }}>なし</span>}</td>
              <td className="px-2 py-1.5"><ModelThumbnail modelUrl={modelsById.get(detail.modelKey ?? "")?.modelUrl ?? null} size={detail.size} colors={detail.colorMaterials} fallbackColor={detail.symbolicColor} label={detail.name} /></td>
              <td className="px-2 py-1.5">
                <button type="button" className="text-left font-medium" onClick={() => select(detail.id)}>{detail.name}</button>
                <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  <span>{detail.shop}</span><span>・{detail.category}</span><span>・{detail.modelKey ?? "モデルなし"}</span>
                  {!detail.enabled && <Badge>非表示</Badge>}
                </div>
              </td>
              <td className="px-2 py-1.5 text-xs whitespace-nowrap">{detail.slot}<br />{detail.position}番</td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">{detail.price.toLocaleString("ja-JP")}円</td>
              <td className="px-2 py-1.5 whitespace-nowrap"><a href={detail.url} target="_blank" rel="noopener noreferrer" className="text-violet-700" onClick={(event) => event.stopPropagation()}>開く ↗</a></td>
            </tr>)}
            {details.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-500">一致する商品がありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    <aside className="order-first md:sticky md:top-4 md:order-none md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto" aria-label="商品の編集" ref={panel}>
      {selected === null
        ? <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">一覧から商品を選ぶと、リンク・画像・寸法・色を編集して3Dで見た目を確かめられます。</p>
        : <DetailEditor key={selected} detail={editing} catalog={catalog} models={models} onCreated={(detail) => setSelected(detail.id)} onClose={() => setSelected(null)} />}
    </aside>
  </div>;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">{children}</span>;
}

type Draft = {
  name: string; url: string; imageUrl: string; shop: string; price: string; category: string; slot: string; position: string;
  themes: string; colorName: string; w: string; h: string; d: string; modelKey: string; symbolicColor: string;
  colorMaterials: Record<string, string>; enabled: boolean;
};

function draftOf(detail: AdminFurnitureDetail | null, catalog: FurnitureAdminCatalog): Draft {
  if (!detail) {
    return {
      name: "", url: "", imageUrl: "", shop: "", price: "", category: "", slot: catalog.slots.includes("floor") ? "floor" : catalog.slots[0] ?? "",
      position: String(Math.max(-1, ...catalog.details.map((existing) => existing.position)) + 1),
      themes: "", colorName: "", w: "", h: "", d: "", modelKey: "", symbolicColor: "#cccccc", colorMaterials: {}, enabled: true,
    };
  }
  return {
    name: detail.name, url: detail.url, imageUrl: detail.imageUrl ?? "", shop: detail.shop, price: String(detail.price), category: detail.category,
    slot: detail.slot, position: String(detail.position), themes: detail.themes.join(", "), colorName: detail.colorName ?? "",
    w: centimeters(detail.size.w), h: centimeters(detail.size.h), d: centimeters(detail.size.d), modelKey: detail.modelKey ?? "",
    symbolicColor: detail.symbolicColor, colorMaterials: detail.colorMaterials, enabled: detail.enabled,
  };
}

function DetailEditor({ detail, catalog, models, onCreated, onClose }: {
  detail: AdminFurnitureDetail | null; catalog: FurnitureAdminCatalog; models: AdminFurnitureModel[];
  onCreated: (detail: AdminFurnitureDetail) => void; onClose: () => void;
}) {
  const save = useSaveFurnitureDetail();
  const remove = useDeleteFurnitureDetail();
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(detail, catalog));
  const [validation, setValidation] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (changes: Partial<Draft>) => { setDraft((current) => ({ ...current, ...changes })); setValidation(null); setSaved(false); save.reset(); };

  const model = models.find((candidate) => candidate.id === draft.modelKey);
  const size = { w: Number(draft.w) / 100, h: Number(draft.h) / 100, d: Number(draft.d) / 100 };
  const validSize = [size.w, size.h, size.d].every((value) => Number.isFinite(value) && value > 0);

  // モデルを変えたら、そのモデルに無い部位の色を外す。1 つも残らなければ最初の部位を代表色で塗る
  const selectModel = (modelKey: string) => {
    const next = models.find((candidate) => candidate.id === modelKey);
    if (!next) return set({ modelKey });
    const kept = Object.fromEntries(Object.entries(draft.colorMaterials).filter(([key]) => next.colorMaterialKeys.includes(key)));
    const colorMaterials = Object.keys(kept).length || !next.colorMaterialKeys.length ? kept : { [next.colorMaterialKeys[0]]: draft.symbolicColor };
    set({ modelKey, colorMaterials, ...(draft.w || draft.h || draft.d ? {} : { w: centimeters(next.size.w), h: centimeters(next.size.h), d: centimeters(next.size.d) }) });
  };
  const togglePart = (key: string, on: boolean) => {
    const rest = Object.fromEntries(Object.entries(draft.colorMaterials).filter(([name]) => name !== key));
    set({ colorMaterials: on ? { ...rest, [key]: draft.symbolicColor } : rest });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (save.isPending || remove.isPending) return;
    const price = Number(draft.price), position = Number(draft.position);
    if (!model) return setValidation("3Dモデルを一覧から選んでください");
    if (!validSize) return setValidation("寸法は0より大きい数字で入力してください");
    if (!Number.isInteger(price) || price <= 0) return setValidation("価格は1以上の整数で入力してください");
    if (!Number.isInteger(position)) return setValidation("並び順は整数で入力してください");
    if (!HEX.test(draft.symbolicColor)) return setValidation("代表色を確認してください");
    if (!Object.keys(draft.colorMaterials).length) return setValidation("色を塗る部位を1つ以上選んでください");
    const input: AdminFurnitureDetailInput = {
      name: draft.name.trim(), category: draft.category.trim(), slot: draft.slot, modelKey: model.id, symbolicColor: draft.symbolicColor,
      colorMaterials: draft.colorMaterials, colorName: draft.colorName.trim() || null, size, price, shop: draft.shop.trim(), url: draft.url.trim(),
      imageUrl: draft.imageUrl.trim() || null, themes: draft.themes.split(/[\s,、]+/).filter(Boolean), position, enabled: draft.enabled,
    };
    save.mutate({ id: detail?.id ?? null, input }, { onSuccess: (result) => { setSaved(true); if (!detail) onCreated(result); } });
  };

  return <form onSubmit={submit} aria-busy={save.isPending} className="space-y-3 rounded-lg border border-[#E4E1EC] bg-white p-4">
    <div className="flex items-center gap-2"><h2 className="font-semibold">{detail ? "商品を編集" : "商品を追加"}</h2><button type="button" className="ml-auto text-sm text-slate-500" onClick={onClose}>閉じる ×</button></div>
    <ModelPreview modelUrl={model?.modelUrl ?? null} size={validSize ? size : model?.size ?? { w: 0.5, h: 0.5, d: 0.5 }} colors={draft.colorMaterials} fallbackColor={draft.symbolicColor} />
    <p className="text-xs text-slate-500">枠線が商品の寸法です。モデルは寸法に収まるよう等倍で拡縮されます（部屋の画面と同じ）。</p>

    <Field label="商品名"><input className={field} required value={draft.name} onChange={(event) => set({ name: event.target.value })} /></Field>
    <Field label="購入リンク" hint={draft.url && <a href={draft.url} target="_blank" rel="noopener noreferrer" className="text-violet-700">開く ↗</a>}><input className={field} type="url" required value={draft.url} onChange={(event) => set({ url: event.target.value })} /></Field>
    <Field label="商品画像のURL"><div className="flex gap-2">
      <input className={field} type="url" value={draft.imageUrl} onChange={(event) => set({ imageUrl: event.target.value })} />
      {draft.imageUrl && <img src={draft.imageUrl} alt="商品画像" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded border border-slate-200 object-cover" />}
    </div></Field>
    <div className="grid grid-cols-2 gap-2">
      <Field label="ショップ"><input className={field} required value={draft.shop} onChange={(event) => set({ shop: event.target.value })} /></Field>
      <Field label="価格（税込・円）"><input className={field} type="number" min={1} step={1} required value={draft.price} onChange={(event) => set({ price: event.target.value })} /></Field>
      <Field label="家具の種類"><input className={field} required list="admin-categories" value={draft.category} onChange={(event) => set({ category: event.target.value })} /></Field>
      <Field label="置き場所の枠"><select className={field} value={draft.slot} onChange={(event) => set({ slot: event.target.value })}>{catalog.slots.map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label="並び順（小さいほど先）"><input className={field} type="number" step={1} required value={draft.position} onChange={(event) => set({ position: event.target.value })} /></Field>
      <Field label="テーマ（カンマ区切り）"><input className={field} value={draft.themes} onChange={(event) => set({ themes: event.target.value })} /></Field>
    </div>
    <datalist id="admin-categories">{catalog.categories.map((value) => <option key={value} value={value} />)}</datalist>
    <fieldset className="grid grid-cols-3 gap-2"><legend className="text-xs text-slate-600">寸法（cm）</legend>
      {(["w", "h", "d"] as const).map((axis) => <label key={axis} className="text-xs text-slate-600">{{ w: "幅", h: "高さ", d: "奥行き" }[axis]}<input className={field} type="number" min={0.1} step={0.1} required value={draft[axis]} onChange={(event) => set({ [axis]: event.target.value })} /></label>)}
    </fieldset>

    <Field label="3Dモデル" hint={model ? `${model.name}・${sizeText(model.size)}cm${model.enabled ? "" : "・無効"}` : "モデルIDを入力して選ぶ"}>
      <input className={field} required list="admin-models" value={draft.modelKey} onChange={(event) => selectModel(event.target.value)} />
    </Field>
    <datalist id="admin-models">{models.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</datalist>
    <div className="grid grid-cols-2 gap-2">
      <Field label="代表色"><ColorInput value={draft.symbolicColor} onChange={(symbolicColor) => set({ symbolicColor })} /></Field>
      <Field label="公式の色名"><input className={field} value={draft.colorName} onChange={(event) => set({ colorName: event.target.value })} /></Field>
    </div>
    {model && <fieldset className="space-y-1"><legend className="text-xs text-slate-600">部位ごとの色（チェックを外した部位はモデルの色のまま）</legend>
      {model.colorMaterialKeys.map((key) => <div key={key} className="flex items-center gap-2 text-sm">
        <label className="flex w-32 items-center gap-1"><input type="checkbox" checked={key in draft.colorMaterials} onChange={(event) => togglePart(key, event.target.checked)} />{key}</label>
        {key in draft.colorMaterials && <ColorInput value={draft.colorMaterials[key]} onChange={(color) => set({ colorMaterials: { ...draft.colorMaterials, [key]: color } })} />}
      </div>)}
      {model.colorMaterialKeys.length === 0 && <p className="text-xs text-slate-500">このモデルには色を変えられる部位がありません。</p>}
    </fieldset>}

    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={(event) => set({ enabled: event.target.checked })} />提案・検索に出す（外すと非表示）</label>
    {validation && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{validation}</p>}
    <ErrorText error={save.error} />
    <div className="flex items-center gap-3">
      <button type="submit" className={primaryButton} disabled={save.isPending || remove.isPending}>{save.isPending ? "保存中…" : "保存"}</button>
      {saved && <span role="status" className="text-sm text-emerald-700">保存しました</span>}
      {detail && !confirming && <button type="button" className="motion-control ml-auto text-sm text-red-700" onClick={() => setConfirming(true)}>削除…</button>}
    </div>
    {detail && confirming && <div role="alertdialog" aria-label="商品の削除の確認" className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p>この商品を削除します。元に戻せません。保存済みの部屋や提案には残ります。一時的に外すだけなら「提案・検索に出す」のチェックを外してください。</p>
      <div className="flex gap-2">
        <button type="button" className="motion-control rounded bg-red-700 px-3 py-1 font-semibold text-white disabled:opacity-50" disabled={remove.isPending} onClick={() => remove.mutate(detail.id, { onSuccess: onClose })}>{remove.isPending ? "削除中…" : "削除する"}</button>
        <button type="button" className={button} disabled={remove.isPending} onClick={() => { setConfirming(false); remove.reset(); }}>やめる</button>
      </div>
      <ErrorText error={remove.error} />
    </div>}
    <p className="text-xs text-slate-500">{detail ? `ID ${detail.id}・${detail.key}` : "保存すると新しい商品として登録されます。"} 保存するとすぐに提案・検索へ反映されます。</p>
  </form>;
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return <label className="block text-xs text-slate-600"><span className="flex items-center gap-2">{label}{hint && <span className="ml-auto text-slate-500">{hint}</span>}</span>{children}</label>;
}

function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <span className="flex items-center gap-2">
    <input type="color" aria-label="色を選ぶ" className="h-8 w-10 rounded border border-slate-300" value={HEX.test(value) ? value : "#cccccc"} onChange={(event) => onChange(event.target.value)} />
    <input className={`${field} w-24 font-mono`} aria-label="色コード" value={value} maxLength={7} onChange={(event) => onChange(event.target.value)} />
  </span>;
}

function ModelsTab() {
  const models = useAdminFurnitureModels();
  if (models.isPending) return <p role="status" className="text-slate-500">読み込み中…</p>;
  if (models.error) return <ErrorText error={models.error} />;
  return <ModelsBoard models={models.data} />;
}

function ModelsBoard({ models }: { models: AdminFurnitureModel[] }) {
  const toggle = useSetFurnitureModelEnabled();
  const [query, setQuery] = useState("");
  const [onlyUsed, setOnlyUsed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const select = (next: string) => { setSelected(next); revealPanel(panel); };
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  const visible = models.filter((model) => (!onlyUsed || model.detailsCount > 0)
    && terms.every((term) => normalized([model.id, model.name, model.category, model.shape].join(" ")).includes(term)));
  const preview = models.find((model) => model.id === selected);

  return <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
    <section aria-label="3Dモデルの一覧" className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grow text-xs text-slate-600">検索<input className={field} type="search" placeholder="モデルID・名前・種類" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="flex items-center gap-1 pb-1 text-sm"><input type="checkbox" checked={onlyUsed} onChange={(event) => setOnlyUsed(event.target.checked)} />商品で使っているものだけ</label>
      </div>
      <p className="text-xs text-slate-600" role="status">{visible.length}件 / 全{models.length}件。GLBと寸法は backend/db/furnitures.json で管理します（ここでは有効・無効だけ切り替えられます）。</p>
      <ErrorText error={toggle.error} />
      <div className="overflow-x-auto rounded-lg border border-[#E4E1EC] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E4E1EC] text-xs text-slate-500"><tr><th className="px-2 py-2">3D</th><th className="px-2 py-2">モデル</th><th className="px-2 py-2">寸法（cm）</th><th className="px-2 py-2">色の部位</th><th className="px-2 py-2 text-right">商品数</th><th className="px-2 py-2">有効</th></tr></thead>
          <tbody>
            {visible.map((model) => <tr key={model.id} aria-selected={selected === model.id} onClick={() => select(model.id)} className={`cursor-pointer border-b border-[#F0EEF5] last:border-0 hover:bg-violet-50 ${selected === model.id ? "bg-violet-100" : ""} ${model.enabled ? "" : "opacity-60"}`}>
              <td className="px-2 py-1.5"><ModelThumbnail modelUrl={model.modelUrl} size={model.size} colors={{}} fallbackColor="#cccccc" label={model.name} /></td>
              <td className="px-2 py-1.5"><button type="button" className="text-left font-medium" onClick={() => select(model.id)}>{model.name}</button><div className="font-mono text-xs text-slate-500">{model.id}・{model.category}</div></td>
              <td className="px-2 py-1.5 text-xs whitespace-nowrap">{sizeText(model.size)}</td>
              <td className="px-2 py-1.5 text-xs">{model.colorMaterialKeys.join(", ") || "なし"}</td>
              <td className="px-2 py-1.5 text-right">{model.detailsCount}</td>
              <td className="px-2 py-1.5"><input type="checkbox" aria-label={`${model.name}を有効にする`} checked={model.enabled} disabled={toggle.isPending} onClick={(event) => event.stopPropagation()} onChange={(event) => toggle.mutate({ id: model.id, enabled: event.target.checked })} /></td>
            </tr>)}
            {visible.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-slate-500">一致するモデルがありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    <aside className="order-first space-y-2 md:sticky md:top-4 md:order-none md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto" aria-label="3Dモデルの見た目" ref={panel}>
      {preview
        ? <div className="space-y-2 rounded-lg border border-[#E4E1EC] bg-white p-4">
          <h2 className="font-semibold">{preview.name}</h2>
          <ModelPreview key={preview.id} modelUrl={preview.modelUrl} size={preview.size} colors={{}} fallbackColor="#cccccc" />
          <dl className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1 text-xs">
            <dt className="text-slate-500">モデルID</dt><dd className="font-mono">{preview.id}</dd>
            <dt className="text-slate-500">形</dt><dd>{preview.shape}{preview.variant ? `（${preview.variant}）` : ""}</dd>
            <dt className="text-slate-500">GLBのパス</dt><dd className="font-mono break-all">{preview.objectKey}</dd>
          </dl>
        </div>
        : <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">一覧からモデルを選ぶと、元の色のまま3Dで確かめられます。</p>}
    </aside>
  </div>;
}
