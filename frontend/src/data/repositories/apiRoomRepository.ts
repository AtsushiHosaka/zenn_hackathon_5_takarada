import { DomainError } from "../../domain/error";
import { isRoomItem, isRoomShape } from "../../domain/room";
import type { GenerateRoomInput, RoomRepository } from "../../domain/roomRepository";
import type { ApiClient } from "../apiClient";
import { createDemoRoom } from "../dummy/dummyRoomRepository";
import { toAnalysisRoomRecord, toAnalyzedRoomDesign, toCoordinatedRoomDesign, toCoordinationRecord, toRoomDesign } from "../records/room";
import type { components } from "../generated/api";

export type RoomApiConfig = {
  contract: "analysis" | "coordination" | "legacy";
  generationPath: string;
  jobPath: string;
  coordinationPath: string;
  coordinationJobPath: string;
  requiresAuth: boolean;
  photoField: string;
  promptField: string;
  styleField: string;
  budgetField: string;
};

const unavailableMessage = "部屋APIの接続先が設定されていません。";

export function createApiRoomRepository(api: ApiClient, config: RoomApiConfig, baseUrl: string): RoomRepository {
  return {
    demo: createDemoRoom,
    async analyze(input, signal) {
      if (config.contract === "legacy") throw new DomainError("この接続先では畳数による部屋解析を利用できません");
      if (config.contract === "coordination") validateCoordinationInput(input);
      const design = await createApiRoomRepository(api, { ...config, contract: "analysis" }, baseUrl).generate(input, signal);
      return { ...design, prompt: input.prompt.trim() || undefined, budget: input.budget, keptObjectIds: design.items.filter(item => item.existing).map(item => item.id) };
    },
    async capabilities() {
      return {
        generation: Boolean(config.generationPath),
        coordination: config.contract !== "analysis",
        input: config.contract === "legacy" ? "photos" : "dimensions",
        message: config.generationPath ? config.contract === "analysis" ? "畳数と部屋の形から、APIの解析モックで部屋を作成します。写真・希望文の解析や商品提案は行いません。" : config.contract === "coordination" ? "部屋解析と商品提案のAPIモックを使います。写真解析とAI生成は未接続で、商品価格は参考値です。" : "設定された生成APIへ写真を送信します。" : unavailableMessage,
      };
    },
    async generate(input, signal) {
      if (!config.generationPath) throw new DomainError(unavailableMessage);
      if (config.contract !== "legacy") {
        const body = dimensionRequest(input);
        if (config.contract === "coordination") validateCoordinationInput(input);
        if (input.roomId !== undefined && !/^[1-9]\d*$/.test(input.roomId)) throw new DomainError("部屋のIDが正しくありません");
        const jobSignal = boundedSignal(signal);
        if (input.roomId !== undefined && !config.jobPath.includes("{id}")) throw new DomainError("部屋の解析結果の取得先が設定されていません");
        let record = toAnalysisRoomRecord(input.roomId !== undefined
          ? await api.send<unknown>(config.jobPath.replace("{id}", encodeURIComponent(input.roomId)), { requiresAuth: config.requiresAuth, signal: jobSignal })
          : await api.send<unknown>(config.generationPath, { method: "POST", body, requiresAuth: config.requiresAuth, signal: jobSignal, timeoutMs: 120_000 }));
        const expectedId = record.id;
        if (input.roomId !== undefined && String(expectedId) !== input.roomId) throw new DomainError("別の部屋の解析結果を受け取りました");
        if (!config.jobPath.includes("{id}") && record.status === "analyzing") throw new DomainError("部屋の解析結果の取得先が設定されていません");
        const pollPath = config.jobPath.replace("{id}", encodeURIComponent(String(expectedId)));
        for (let attempt = 0; attempt < 60; attempt++) {
          if (record.status === "failed") throw new DomainError(record.error_message || "部屋の解析に失敗しました");
          if (record.status === "ready") {
            if (config.contract === "analysis") return toAnalyzedRoomDesign(record, baseUrl);
            if (!config.coordinationPath.includes("{id}")) throw new DomainError("コーディネートの作成先が設定されていません");
            const keptObjectIds = input.keptObjectIds ?? [];
            if (!Array.isArray(keptObjectIds) || keptObjectIds.some(id => typeof id !== "string" || !record.scene?.objects.some(item => item.source === "existing" && item.id === id)) || new Set(keptObjectIds).size !== keptObjectIds.length) throw new DomainError("活かす家具の選択が正しくありません");
            const request: components["schemas"]["CoordinationInput"] = { coordination: { prompt: input.prompt.trim(), budget: input.budget, kept_object_ids: keptObjectIds, edited_objects: editedObjects(input, record) } };
            let coordination = toCoordinationRecord(await api.send<unknown>(config.coordinationPath.replace("{id}", String(record.id)), { method: "POST", body: request, requiresAuth: config.requiresAuth, signal: jobSignal, timeoutMs: 120_000 }));
            const coordinationId = coordination.id;
            if (coordination.room_id !== expectedId) throw new DomainError("別の部屋のコーディネートを受け取りました");
            for (let step = 0; step < 60; step++) {
              if (coordination.status === "failed") throw new DomainError(coordination.error_message || "コーディネートに失敗しました");
              if (coordination.status === "done") return toCoordinatedRoomDesign(coordination, baseUrl, { tatami: record.tatami, shape: record.shape });
              if (!config.coordinationJobPath.includes("{id}")) throw new DomainError("コーディネートの取得先が設定されていません");
              await pause(2_000, jobSignal);
              coordination = toCoordinationRecord(await api.send<unknown>(config.coordinationJobPath.replace("{id}", String(coordinationId)), { requiresAuth: config.requiresAuth, signal: jobSignal }));
              if (coordination.id !== coordinationId || coordination.room_id !== expectedId) throw new DomainError("別のコーディネートを受け取りました");
            }
            throw new DomainError("コーディネートに時間がかかっています。少し待ってから再度お試しください");
          }
          await pause(2_000, jobSignal);
          record = toAnalysisRoomRecord(await api.send<unknown>(pollPath, { requiresAuth: config.requiresAuth, signal: jobSignal }));
          if (record.id !== expectedId) throw new DomainError("別の部屋の解析結果を受け取りました");
        }
        throw new DomainError("解析に時間がかかっています。少し待ってから再度お試しください");
      }
      validateInput(input);
      const request = new FormData();
      input.photos.forEach(photo => request.append(config.photoField, photo, photo.name));
      request.append(config.promptField, input.prompt.trim());
      request.append(config.styleField, input.style);
      request.append(config.budgetField, String(input.budget));
      // ジョブ全体は最大120秒。通信と待機の両方を同じsignalで止める。
      const jobSignal = boundedSignal(signal);
      let result = await api.send<unknown>(config.generationPath, { method: "POST", body: request, requiresAuth: config.requiresAuth, signal: jobSignal, timeoutMs: 120_000 });
      let pollPath: string | undefined;
      for (let attempt = 0; attempt < 60; attempt++) {
        if (!result || typeof result !== "object") throw new DomainError("生成APIの応答が正しくありません");
        const record = result as Record<string, unknown>;
        if (record.status === "failed" || record.status === "cancelled") throw new DomainError(typeof record.error === "string" ? record.error : "部屋の生成に失敗しました");
        if (record.status === "queued" || record.status === "processing" || record.status === "pending") {
          if (!pollPath) {
            const id = record.job_id ?? record.jobId ?? record.id;
            if (!config.jobPath.includes("{id}") || !validJobId(id)) throw new DomainError("生成ジョブの取得先が設定されていません");
            pollPath = config.jobPath.replace("{id}", encodeURIComponent(String(id)));
          }
          await pause(2_000, jobSignal);
          result = await api.send<unknown>(pollPath, { requiresAuth: config.requiresAuth, signal: jobSignal });
          continue;
        }
        if (record.status && record.status !== "completed" && record.status !== "succeeded") throw new DomainError("生成ジョブの状態を解釈できませんでした");
        return toRoomDesign(record.design ?? record.result ?? result, baseUrl);
      }
      throw new DomainError("生成に時間がかかっています。少し待ってから再度お試しください");
    },
  };
}

function editedObjects(input: GenerateRoomInput, record: components["schemas"]["Room"]): components["schemas"]["FurnitureEdit"][] {
  if (!input.editedItems) return [];
  if (!Array.isArray(input.editedItems) || !input.editedItems.every(isRoomItem) || new Set(input.editedItems.map(item => item.id)).size !== input.editedItems.length || !record.scene) throw new DomainError("家具の編集内容が正しくありません");
  const { room } = record.scene;
  return input.editedItems.map(item => ({
    id: item.id,
    position: { x: item.position[0] + room.width / 2, y: item.position[1] - item.size[1] / 2, z: item.position[2] + room.depth / 2 },
    size: { w: item.size[0], h: item.size[1], d: item.size[2] },
    rotation_y: item.rotation ?? 0,
    color: item.color,
  }));
}

function boundedSignal(signal?: AbortSignal): AbortSignal {
  const deadline = AbortSignal.timeout(120_000);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}

function dimensionRequest(input: GenerateRoomInput): components["schemas"]["RoomInput"] {
  if (typeof input.tatami !== "number" || !Number.isFinite(input.tatami) || input.tatami < 3 || input.tatami > 30) throw new DomainError("部屋の広さを3〜30畳で入力してください");
  if (!isRoomShape(input.shape)) throw new DomainError("部屋の形を選んでください");
  return { room: { tatami: input.tatami, shape: input.shape } };
}

function validateCoordinationInput(input: GenerateRoomInput) {
  if (!input.prompt.trim() || input.prompt.length > 500) throw new DomainError("部屋の希望を500文字以内で入力してください");
  if (!Number.isSafeInteger(input.budget) || input.budget <= 0) throw new DomainError("予算は1円以上の整数で入力してください");
}

function validJobId(value: unknown): value is string | number {
  return (typeof value === "string" && Boolean(value.trim())) || (typeof value === "number" && Number.isFinite(value));
}

function validateInput(input: GenerateRoomInput) {
  if (input.photos.length < 3 || input.photos.length > 4) throw new DomainError("部屋の写真を3〜4枚選んでください");
  if (input.photos.some(photo => !["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 10 * 1024 * 1024 || photo.size === 0)) throw new DomainError("写真は1枚10MB以内のJPEG・PNG・WebPを選んでください");
  if (!input.prompt.trim()) throw new DomainError("どんな部屋にしたいか入力してください");
  if (!Number.isFinite(input.budget) || input.budget < 0) throw new DomainError("予算は0円以上で入力してください");
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError(signal)); return; }
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    function abort() { clearTimeout(timer); reject(abortError(signal)); }
    signal.addEventListener("abort", abort, { once: true });
  });
}

function abortError(signal: AbortSignal): DomainError {
  return new DomainError(signal.reason instanceof DOMException && signal.reason.name === "TimeoutError" ? "生成に時間がかかっています。少し待ってから再度お試しください" : "操作をキャンセルしました");
}
