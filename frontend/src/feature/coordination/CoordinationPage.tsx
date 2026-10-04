// コーデ提案を一通り試すための最小の画面 (API とのつなぎ込みの確認用)。
// 見た目の作り込み (docs/design.png) は別途。ログイン不要。
//   STEP1 畳数・部屋の形 → 解析 → 活かす家具を選ぶ
//   STEP2 要望・予算 → 生成 → RESULT (3D・購入リンク)
import { useState } from "react";
import type { Coordination, CoordinationId } from "../../domain/coordination";
import type { Room, RoomId, RoomShape } from "../../domain/room";
import ConnectionSwitch from "../shared/ConnectionSwitch";
import ErrorText from "../shared/ErrorText";
import SceneViewer from "./SceneViewer";
import { useCoordination, useCreateCoordination, useCreateRoom, useRoom } from "./queries";

const SHAPES: { value: RoomShape; label: string }[] = [
  { value: "square", label: "正方形に近い" },
  { value: "standard", label: "やや縦長" },
  { value: "long", label: "細長い" },
];

const EXAMPLES = [
  { label: "推し活パープル", prompt: "紫色の推し活ルームにしたい。アクスタやぬいを飾れて、夜はふんわり光る感じに。" },
  { label: "ボタニカル", prompt: "観葉植物いっぱいのボタニカルな部屋にしたい。" },
  { label: "韓国インテリア", prompt: "くすみベージュの韓国インテリアにしたい。" },
];

const BUDGETS = [10000, 30000, 50000];

const yen = (value: number) => `¥${value.toLocaleString("ja-JP")}`;

const card = "space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";
const chip =
  "rounded-full border border-slate-300 px-3 py-1 text-sm aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white dark:border-slate-600 dark:aria-pressed:border-slate-100 dark:aria-pressed:bg-slate-100 dark:aria-pressed:text-slate-900";
const primaryButton =
  "rounded bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50";

export default function CoordinationPage() {
  const [roomId, setRoomId] = useState<RoomId | null>(null);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <h1 className="font-semibold">AI ルームコーディネーター</h1>
          <div className="ml-auto">
            <ConnectionSwitch />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <RoomForm onCreated={setRoomId} />
        {roomId !== null && <RoomStep key={roomId} roomId={roomId} />}
      </main>
    </div>
  );
}

// STEP1: 部屋の登録
function RoomForm({ onCreated }: { onCreated: (id: RoomId) => void }) {
  const createRoom = useCreateRoom();
  const [tatami, setTatami] = useState(6);
  const [shape, setShape] = useState<RoomShape>("standard");

  return (
    <section className={card}>
      <h2 className="font-semibold">STEP1 部屋の情報</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        写真のアップロードは API が未実装のため、今は畳数と部屋の形だけを送ります。
      </p>

      <label className="flex items-center gap-2 text-sm">
        <span>広さ</span>
        <input
          id="tatami"
          type="number"
          min={3}
          max={30}
          step={0.5}
          value={tatami}
          onChange={(event) => setTatami(Number(event.target.value))}
          className="w-20 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
        />
        <span>畳</span>
      </label>

      <div className="space-y-2">
        <p className="text-sm">部屋の形</p>
        <div className="flex flex-wrap gap-2">
          {SHAPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setShape(option.value)}
              aria-pressed={shape === option.value}
              className={chip}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorText error={createRoom.error} />

      <button
        type="button"
        onClick={() => createRoom.mutate({ tatami, shape }, { onSuccess: (room) => onCreated(room.id) })}
        disabled={createRoom.isPending}
        className={primaryButton}
      >
        {createRoom.isPending ? "送信中..." : "部屋を解析する"}
      </button>
    </section>
  );
}

function RoomStep({ roomId }: { roomId: RoomId }) {
  const room = useRoom(roomId);

  if (room.isPending) return <p className="text-sm text-slate-500">読み込み中...</p>;
  if (room.error) return <ErrorText error={room.error} />;
  if (room.data.status === "analyzing") return <p className="text-sm text-slate-500">部屋を解析中...</p>;
  if (room.data.status === "failed" || !room.data.scene) {
    return <ErrorText error={new Error(room.data.errorMessage ?? "部屋の解析に失敗しました")} />;
  }
  return <CoordinationForm room={room.data} />;
}

// 検出した家具の「活かす」選択と、STEP2: 要望・予算
function CoordinationForm({ room }: { room: Room }) {
  const furniture = room.scene?.objects ?? [];
  const createCoordination = useCreateCoordination(room.id);
  const [kept, setKept] = useState<string[]>(furniture.map((object) => object.id));
  const [prompt, setPrompt] = useState(EXAMPLES[0].prompt);
  const [budget, setBudget] = useState(30000);
  const [coordinationId, setCoordinationId] = useState<CoordinationId | null>(null);

  const toggle = (id: string) =>
    setKept((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const submit = () =>
    createCoordination.mutate(
      { prompt, budget, keptObjectIds: kept },
      { onSuccess: (coordination) => setCoordinationId(coordination.id) },
    );

  return (
    <>
      <section className={card}>
        <h2 className="font-semibold">AI が見つけた家具</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">残したいものはそのまま 3D に反映します。</p>
        <ul className="flex flex-wrap gap-2">
          {furniture.map((object) => (
            <li key={object.id}>
              <button
                type="button"
                onClick={() => toggle(object.id)}
                aria-pressed={kept.includes(object.id)}
                className={chip}
              >
                {object.label} {kept.includes(object.id) ? "・活かす" : "・外す"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className="font-semibold">STEP2 どんな部屋にしたい？</h2>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => setPrompt(example.prompt)}
              aria-pressed={prompt === example.prompt}
              className={chip}
            >
              {example.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm">買い足しの予算</p>
          <div className="flex flex-wrap gap-2">
            {BUDGETS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setBudget(value)}
                aria-pressed={budget === value}
                className={chip}
              >
                〜{value / 10000}万円
              </button>
            ))}
          </div>
        </div>

        <ErrorText error={createCoordination.error} />

        <button
          type="button"
          onClick={submit}
          disabled={createCoordination.isPending || prompt.trim() === ""}
          className={primaryButton}
        >
          {createCoordination.isPending ? "送信中..." : "AI でコーディネートする"}
        </button>
      </section>

      {coordinationId !== null && <CoordinationResult key={coordinationId} coordinationId={coordinationId} />}
    </>
  );
}

function CoordinationResult({ coordinationId }: { coordinationId: CoordinationId }) {
  const coordination = useCoordination(coordinationId);

  if (coordination.isPending) return <p className="text-sm text-slate-500">読み込み中...</p>;
  if (coordination.error) return <ErrorText error={coordination.error} />;
  const { status } = coordination.data;
  if (status === "pending" || status === "processing") {
    return <p className="text-sm text-slate-500">コーディネートを生成中...</p>;
  }
  if (status === "failed") {
    return <ErrorText error={new Error(coordination.data.errorMessage ?? "コーディネートの生成に失敗しました")} />;
  }
  return <ResultView coordination={coordination.data} />;
}

// RESULT: 3D (ビフォー/アフター)・購入リンク・AI のコメント
function ResultView({ coordination }: { coordination: Coordination }) {
  const [mode, setMode] = useState<"before" | "after">("after");
  const scene = mode === "after" ? coordination.afterScene : coordination.beforeScene;
  const kept = coordination.afterScene?.objects.filter((object) => object.source === "existing") ?? [];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{coordination.title}</h2>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className={card}>
          <div className="flex gap-1">
            {(["before", "after"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={chip}
              >
                {value === "before" ? "ビフォー (今の部屋)" : "アフター (AI 提案)"}
              </button>
            ))}
          </div>
          {scene && <SceneViewer scene={scene} />}
          {coordination.comment && (
            <p className="rounded bg-violet-50 px-3 py-2 text-sm dark:bg-violet-950">
              <span className="mr-2 font-semibold text-violet-700 dark:text-violet-300">AI のコメント</span>
              {coordination.comment}
            </p>
          )}
        </div>

        <div className={card}>
          <h3 className="flex items-baseline justify-between font-semibold">
            追加アイテムの購入リンク
            <span className="text-xs font-normal text-slate-500">{coordination.items.length} 点</span>
          </h3>
          <ul className="space-y-2">
            {coordination.items.map((item) => (
              <li
                key={item.marker}
                className="grid grid-cols-[22px_28px_minmax(0,1fr)_auto] items-center gap-2 rounded border border-slate-200 p-2 dark:border-slate-700"
              >
                <span className="grid size-[22px] place-items-center rounded-full bg-violet-700 text-[11px] text-white">
                  {item.marker}
                </span>
                <span className="size-7 rounded border border-slate-200" style={{ background: item.color }} />
                <span className="min-w-0 text-sm">
                  <span className="block break-words font-medium">{item.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {item.placementNote}・{item.shop === "amazon" ? "Amazon" : "楽天"}・{yen(item.price)}
                  </span>
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-slate-900 px-2 py-1 text-xs text-white dark:bg-slate-100 dark:text-slate-900"
                >
                  見る
                </a>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-slate-200 pt-3 font-semibold tabular-nums dark:border-slate-700">
            <span>
              合計 <span className="text-xs font-normal text-slate-500">(予算 {yen(coordination.budget)})</span>
            </span>
            <span>{yen(coordination.totalPrice ?? 0)}</span>
          </p>
          {kept.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">そのまま活かした持ち物</p>
              <p className="flex flex-wrap gap-1">
                {kept.map((object) => (
                  <span key={object.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                    {object.label}
                  </span>
                ))}
              </p>
            </div>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            価格は仮データのダミー値で、リンク先は EC の検索結果ページです。
          </p>
        </div>
      </div>
    </section>
  );
}
