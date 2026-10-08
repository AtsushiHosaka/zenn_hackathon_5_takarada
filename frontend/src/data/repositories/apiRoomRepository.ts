import { DomainError } from "../../domain/error";
import { roomPhotoLimits, roomPhotoValidationError } from "../../domain/roomPhoto";
import { furnitureCategories, isFurnitureAdditions, isFurnitureOperations, isManualFurniture, isRoomItem, isRoomShape } from "../../domain/room";
import type { GenerateRoomInput, RoomRepository } from "../../domain/roomRepository";
import type { ApiClient } from "../apiClient";
import { createDemoRoom } from "../dummy/dummyRoomRepository";
import { toAnalysisRoomRecord, toAnalyzedRoomDesign, toCoordinatedRoomDesign, toCoordinationRecord, toImportedFurniture, toRoomDesign, toSavedRoom, toSavedRooms, toUploadRecords } from "../records/room";
import type { components } from "../generated/api";

export type RoomApiConfig = {
  contract: "analysis" | "coordination" | "legacy";
  generationPath: string;
  jobPath: string;
  coordinationPath: string;
  coordinationJobPath: string;
  uploadsPath: string;
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
    async importFurniture(url, signal) {
      let parsed: URL;
      try { parsed = new URL(url.trim()); } catch { throw new DomainError("商品ページのURLを入力してください"); }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || url.length > 2048) throw new DomainError("HTTPSの商品ページURLを入力してください");
      return toImportedFurniture(await api.send<unknown>("/api/v1/furniture_imports", {
        method: "POST", body: { url: parsed.href }, signal, timeoutMs: 60_000,
      }), baseUrl);
    },
    async list(signal) {
      if (config.contract === "legacy") throw new DomainError("この接続先では保存した部屋を取得できません");
      if (!config.generationPath) throw new DomainError(unavailableMessage);
      return toSavedRooms(await api.send<unknown>(config.generationPath, { requiresAuth: true, signal }), baseUrl);
    },
    async get(id, signal) {
      if (config.contract === "legacy") throw new DomainError("この接続先では保存した部屋を取得できません");
      const coordinationMatch = /^api-coordination-([1-9]\d*)$/.exec(id);
      if (coordinationMatch) {
        if (!config.coordinationJobPath.includes("{id}")) throw new DomainError("コーディネートの取得先が設定されていません");
        const coordinationId = coordinationMatch[1];
        const coordination = toCoordinationRecord(await api.send<unknown>(config.coordinationJobPath.replace("{id}", coordinationId), { requiresAuth: true, signal }));
        if (String(coordination.id) !== coordinationId) throw new DomainError("別のコーディネートを受け取りました");
        if (coordination.status === "failed") throw new DomainError(coordination.error_message || "コーディネートに失敗しました");
        if (coordination.status !== "done") throw new DomainError("コーディネートはまだ完了していません");
        if (!config.jobPath.includes("{id}")) throw new DomainError("部屋の取得先が設定されていません");
        const record = toAnalysisRoomRecord(await api.send<unknown>(config.jobPath.replace("{id}", String(coordination.room_id)), { requiresAuth: true, signal }));
        if (record.id !== coordination.room_id) throw new DomainError("別の部屋を受け取りました");
        return toCoordinatedRoomDesign(coordination, baseUrl, { tatami: record.tatami, shape: record.shape });
      }
      const roomId = /^api-room-([1-9]\d*)$/.exec(id)?.[1] ?? id;
      if (!/^[1-9]\d*$/.test(roomId)) throw new DomainError("部屋のIDが正しくありません");
      if (!config.jobPath.includes("{id}")) throw new DomainError("部屋の取得先が設定されていません");
      const room = toSavedRoom(await api.send<unknown>(config.jobPath.replace("{id}", encodeURIComponent(roomId)), { requiresAuth: true, signal }), baseUrl);
      if (room.id !== roomId) throw new DomainError("別の部屋を受け取りました");
      if (room.status === "failed") throw new DomainError(room.errorMessage || "部屋の解析に失敗しました");
      if (!room.design) throw new DomainError("部屋の解析はまだ完了していません");
      return room.design;
    },
    async analyze(input, signal) {
      if (config.contract === "legacy") throw new DomainError("この接続先では畳数による部屋解析を利用できません");
      const design = await createApiRoomRepository(api, { ...config, contract: "analysis" }, baseUrl).generate(input, signal);
      return { ...design, prompt: input.prompt.trim() || undefined, budget: input.budget, keptObjectIds: design.items.filter(item => item.existing).map(item => item.id) };
    },
    async capabilities() {
      return {
        generation: Boolean(config.generationPath),
        coordination: config.contract !== "analysis",
        input: config.contract === "legacy" ? "photos" : "dimensions",
        photos: config.contract === "legacy" || Boolean(config.uploadsPath),
        message: config.generationPath ? config.contract === "analysis" ? "畳数と部屋の形から、APIの解析モックで部屋を作成します。写真・希望文の解析や商品提案は行いません。" : config.contract === "coordination" ? "写真を付けると、AI (Gemini) が部屋の色・窓・家具を読み取ります。希望文に合う商品もAIが選びます。サーバーにAPIキーが無いときはモックで動きます。商品価格は参考値です。" : "設定された生成APIへ写真を送信します。" : unavailableMessage,
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
        let photoBody = body;
        if (input.roomId === undefined) {
          if (input.photos.length && config.uploadsPath) input.onProgress?.("uploading");
          photoBody = await withPhotoKeys(api, config, body, input.photos, jobSignal);
        }
        input.onProgress?.("analyzing");
        let record = toAnalysisRoomRecord(input.roomId !== undefined
          ? await api.send<unknown>(config.jobPath.replace("{id}", encodeURIComponent(input.roomId)), { requiresAuth: config.requiresAuth, signal: jobSignal })
          : await api.send<unknown>(config.generationPath, { method: "POST", body: photoBody, requiresAuth: config.requiresAuth, signal: jobSignal, timeoutMs: 120_000 }));
        const expectedId = record.id;
        if (input.roomId !== undefined && String(expectedId) !== input.roomId) throw new DomainError("別の部屋の解析結果を受け取りました");
        if (!config.jobPath.includes("{id}") && record.status === "analyzing") throw new DomainError("部屋の解析結果の取得先が設定されていません");
        const pollPath = config.jobPath.replace("{id}", encodeURIComponent(String(expectedId)));
        for (let attempt = 0; attempt < 60; attempt++) {
          if (record.status === "failed") throw new DomainError(record.error_message || "部屋の解析に失敗しました");
          if (record.status === "ready") {
            if (config.contract === "analysis") { const result = toAnalyzedRoomDesign(record, baseUrl); input.onProgress?.("preview"); return result; }
            if (!config.coordinationPath.includes("{id}")) throw new DomainError("コーディネートの作成先が設定されていません");
            const edits = editedObjects(input, record);
            const existingIds = [...(record.scene?.objects.filter(item => item.source === "existing").map(item => item.id) ?? []), ...edits.filter(edit => edit.category !== undefined).map(edit => edit.id)];
            if (input.furnitureOperations !== undefined && (!isFurnitureOperations(input.furnitureOperations) || input.furnitureOperations.length !== existingIds.length || input.furnitureOperations.some(operation => !existingIds.includes(operation.objectId)))) throw new DomainError("各家具について残すか入れ替えるかを選んでください");
            const keptObjectIds = input.furnitureOperations?.filter(operation => operation.action === "keep").map(operation => operation.objectId) ?? input.keptObjectIds ?? [];
            if (!Array.isArray(keptObjectIds) || keptObjectIds.some(id => typeof id !== "string" || !existingIds.includes(id)) || new Set(keptObjectIds).size !== keptObjectIds.length) throw new DomainError("活かす家具の選択が正しくありません");
            const request: components["schemas"]["CoordinationInput"] = { coordination: { prompt: input.prompt.trim(), budget: input.budget, kept_object_ids: keptObjectIds, edited_objects: edits, ...(input.baseCoordinationId && /^[1-9]\d*$/.test(input.baseCoordinationId) ? { base_coordination_id: Number(input.baseCoordinationId) } : {}), ...(input.furnitureOperations === undefined ? {} : { furniture_operations: input.furnitureOperations.map(operation => ({ object_id: operation.objectId, action: operation.action })) }), ...(input.furnitureAdditions === undefined ? {} : { additions: input.furnitureAdditions }) } };
            input.onProgress?.("coordinating");
            let coordination = toCoordinationRecord(await api.send<unknown>(config.coordinationPath.replace("{id}", String(record.id)), { method: "POST", body: request, requiresAuth: config.requiresAuth, signal: jobSignal, timeoutMs: 270_000 }));
            const coordinationId = coordination.id;
            if (coordination.room_id !== expectedId) throw new DomainError("別の部屋のコーディネートを受け取りました");
            for (let step = 0; step < 120; step++) {
              if (coordination.status === "failed") throw new DomainError(coordination.error_message || "コーディネートに失敗しました");
              if (coordination.status === "done") { const result = toCoordinatedRoomDesign(coordination, baseUrl, { tatami: record.tatami, shape: record.shape }); input.onProgress?.("preview"); return result; }
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
      input.onProgress?.("analyzing");
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
        const design = toRoomDesign(record.design ?? record.result ?? result, baseUrl);
        input.onProgress?.("preview");
        return design;
      }
      throw new DomainError("生成に時間がかかっています。少し待ってから再度お試しください");
    },
  };
}

function editedObjects(input: GenerateRoomInput, record: components["schemas"]["Room"]): components["schemas"]["FurnitureEdit"][] {
  if (!input.editedItems) return [];
  if (!Array.isArray(input.editedItems) || input.editedItems.length > 100 || !input.editedItems.every(isRoomItem) || new Set(input.editedItems.map(item => item.id)).size !== input.editedItems.length || !record.scene) throw new DomainError("家具の編集内容が正しくありません");
  if (input.editedItems.some(item => isManualFurniture(item) && (!furnitureCategories.some(category => category === item.category) || !item.ecProductId && item.name.length > 100))) throw new DomainError("手動で追加した家具の種類または名前が正しくありません");
  const { room } = record.scene;
  return input.editedItems.map(item => ({
    id: item.id,
    position: { x: item.position[0] + room.width / 2, y: item.position[1] - item.size[1] / 2, z: item.position[2] + room.depth / 2 },
    size: { w: item.size[0], h: item.size[1], d: item.size[2] },
    rotation_y: item.rotation ?? 0,
    color: item.color,
    ...(isManualFurniture(item) ? { category: item.category as typeof furnitureCategories[number], ...(!item.ecProductId ? { label: item.name } : {}) } : {}),
    ...(isManualFurniture(item) && item.ecProductId ? { ec_product_id: Number(item.ecProductId) } : {}),
  }));
}

function boundedSignal(signal?: AbortSignal): AbortSignal {
  const deadline = AbortSignal.timeout(360_000);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}

function dimensionRequest(input: GenerateRoomInput): components["schemas"]["RoomInput"] {
  if (typeof input.tatami !== "number" || !Number.isFinite(input.tatami) || input.tatami < 3 || input.tatami > 30) throw new DomainError("部屋の広さを3〜30畳で入力してください");
  if (!isRoomShape(input.shape)) throw new DomainError("部屋の形を選んでください");
  return { room: { tatami: input.tatami, shape: input.shape } };
}

// 写真はAPIを通さずGCSへ直接送り、得たkeyだけをPOST /roomsに渡す。
// 写真は任意 (backend の photo_keys も任意。写真があれば Gemini で解析し、無ければ畳数と部屋の形から作るモック)
async function withPhotoKeys(api: ApiClient, config: RoomApiConfig, body: components["schemas"]["RoomInput"], photos: File[], signal: AbortSignal): Promise<components["schemas"]["RoomInput"]> {
  if (!config.uploadsPath || photos.length === 0) return body;

  const uploads = toUploadRecords(await api.send<unknown>(config.uploadsPath, {
    method: "POST",
    body: { uploads: photoUploadRequest(photos) } satisfies components["schemas"]["UploadInput"],
    requiresAuth: config.requiresAuth,
    signal,
  }), photos.length);

  // 署名にsizeとContent-Typeが入っているので、発行時と同じFileをそのまま送る
  await Promise.all(uploads.map((upload, index) => api.sendToSignedUrl(upload.upload_url, photos[index], signal)));
  return { room: { ...body.room, photo_keys: uploads.map(upload => upload.key) } };
}

type PhotoContentType = components["schemas"]["UploadInput"]["uploads"][number]["content_type"];

// sizeは署名に入るのでここで申告した値とPUTする中身が一致していなければならない
function photoUploadRequest(photos: File[]): components["schemas"]["UploadInput"]["uploads"] {
  if (photos.length > roomPhotoLimits.maxCount) throw new DomainError("写真は最大4枚です");
  return photos.map(photo => {
    const error = roomPhotoValidationError(photo);
    if (error) throw new DomainError(error);
    return { content_type: photo.type as PhotoContentType, size: photo.size };
  });
}

function validateCoordinationInput(input: GenerateRoomInput) {
  if (!input.prompt.trim() || input.prompt.length > 500) throw new DomainError("部屋の希望を500文字以内で入力してください");
  if (!Number.isSafeInteger(input.budget) || input.budget <= 0) throw new DomainError("予算は1円以上の整数で入力してください");
  if (input.furnitureOperations !== undefined && !isFurnitureOperations(input.furnitureOperations)) throw new DomainError("家具の操作が正しくありません");
  if (input.furnitureAdditions !== undefined && !isFurnitureAdditions(input.furnitureAdditions)) throw new DomainError("追加する家具は6点までで種類を選んでください");
}

function validJobId(value: unknown): value is string | number {
  return (typeof value === "string" && Boolean(value.trim())) || (typeof value === "number" && Number.isFinite(value));
}

function validateInput(input: GenerateRoomInput) {
  if (input.photos.length < 3 || input.photos.length > 4) throw new DomainError("部屋の写真を3〜4枚選んでください");
  photoUploadRequest(input.photos);
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
