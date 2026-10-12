# Issue #69: room step indicator investigation

Investigated on 2026-10-09 JST against `36eb6bd` (current `origin/main`).
Source: https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/69.
The Google Docs URL in `docs/project.md` is not configured.

## Finding

The three-row generation checklist remains on its first row throughout the request. This is a presentation limitation, not evidence that room generation itself stops. A separate numbered input wizard advances correctly in the browser.

`frontend/src/feature/room/RoomGenerating.tsx` defines the dimension-mode rows as:

| Row | Label | Current behavior | Intended completion event |
| --- | --- | --- | --- |
| 1 | 部屋を準備 | Always active | Room analysis becomes ready; or an existing ready room is loaded |
| 2 | コーディネートを受信 | Always pending | Coordination becomes done |
| 3 | 3Dプレビューを表示 | Always pending | Result screen and its preview load |

There is no event that changes these row states. The parent passes only `dimensions`, `coordination`, and `sample`; it does not pass the actual request phase. The repository completes room analysis and then requests coordination, but these transitions are hidden inside a single `generate()` promise. Once the promise resolves, the entire generating screen is replaced by the result screen. Its later rows never become active.

The existing backend serializer returns coordination `status`, but no detailed generation stage. Accurate stage reporting will need frontend lifecycle events for known transitions, and additional API progress only for finer stages. Advancing rows on a timer would misrepresent actual processing.

## Reproduction and evidence

One Chromium session, local Vite at `http://127.0.0.1:5174`, viewport 1440 × 1000, API connection. Authentication and room/coordination responses were intercepted in the browser with fixtures; no production data or providers were accessed.

1. Open `/rooms/new` with dimension + photo capabilities. Its numbered input wizard is **1 広さ → 2 形 → 3 写真**. The default valid 6畳 input advances with 次へ. Another 次へ reaches the optional photo step. These are input steps, not generation stages. See [step 2](input-step-2.png) and [step 3](input-step-3.png).
2. Open a fixture room at `/rooms/41`: GET `/api/v1/rooms/41` returns HTTP 200, `status: ready`, valid room scene. The page resolves to `/rooms/api-room-41` and displays 解析完了.
3. Enter `落ち着いた部屋にしたい` and press この家具でコーディネート. The repository GETs the same ready room and POSTs `/api/v1/rooms/41/coordinations`. Delay that POST's HTTP 200 response by eight seconds to expose the pending view.
4. During that pending coordination request, the generating checklist still says **部屋を準備** is active and the other two rows are pending, although room preparation is already complete. See [generation checklist](generation-first-stage.png).
5. Return a valid `done` coordination response. The app navigates to `/rooms/api-coordination-102` and displays **コーディネート完了**. This proves the presentation issue can occur on a successfully completed request.

## Implementation and remaining evidence

PR #82 now exposes upload, analysis, coordination, and received-result phases through repository callbacks. The generating view advances from these observed events and renders only relevant phases. Its final preview phase means the result was received and is ready for navigation; it does not prove that the 3D assets have rendered. Detailed product-search progress still needs an API contract change.

The baseline evidence above was collected before the PR #82 runtime change. It records the cause separately from the fixed implementation's screenshot, `coordination-progress.png`. The original report did not include an affected URL, screenshot, connection mode, or browser version. Production reproduction, real Gemini/EC calls, real database behavior, and any different historical step display remain unverified. To match the original report exactly, obtain its screenshot/URL and connection mode.
