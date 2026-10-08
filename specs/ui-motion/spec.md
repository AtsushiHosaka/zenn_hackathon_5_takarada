# Web motion foundation

## Source and scope

GitHub issue [#50](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/50), read 2026-10-09, supplies the approved web-only requirements. Dependent issues #51–#58 define feature wiring and combined verification. `docs/project.md` has no Google Docs URL, so Docs were not available and these decisions remain unreflected there.

Preserve layout, purple identity, native activation/navigation, authentication and API behavior. No dependency or new test is required. Features #51–#57 own wiring; #58 owns complete inventory verification.

## Acceptance and decisions

- Reusable CSS control feedback changes colors, shadows and opacity; it does not move or scale a focused target. `motion-control` covers hover, focus, active, selected (`aria-pressed`, `aria-selected`, `data-selected`) and disabled feedback. `motion-field` covers field border/focus feedback. Existing shared primary/secondary/account buttons receive the same treatment.
- Shared durations: controls 120ms, local changes 180ms, entrances 240ms, exits 150ms. `motionStaggerStyle(index)` caps 30ms stagger at 120ms; CSS clamps supplied delays too.
- `motion-enter`, `motion-fade`, and `motion-presence` animate opacity and the individual `translate` property. Existing positioning `transform` remains intact. Consumers must not place motion travel on a dragging element whose individual translate is already owned by interaction.
- Reduced motion disables CSS transitions/animations/scroll smoothing. `useReducedMotion()` subscribes to live preference changes for future JavaScript consumers; imperative `motionScrollIntoView()` reads the preference at invocation and uses instant scrolling when reduced. The 3D render loop is functional rendering and remains unchanged.
- `useMotionPresence(open, exitDuration?)` returns `{isPresent, state}`. It retains exactly one subtree for exit, cancels timers on reopen/navigation/unmount, and removes retained exit content immediately if reduced motion becomes enabled. `state` supplies the CSS `data-motion-state` attribute. Custom durations must match CSS `--motion-exit-duration`.
- Nonmodal retained content must become `inert` and `aria-hidden` as closing starts. Native dialogs must remain modal through exit, prevent native premature Escape close, and restore focus only after the helper finishes. Dialog wiring belongs to #56; consumers must retain valid trigger references and disable exiting actions.
- Entrance animation belongs to a newly mounted logical block with stable keys. Do not remount an entire list on selection, add request timers, delay submits, or mount a second WebGL viewer. No global transition-all rule exists.

## Verification

Passed `npm run lint`, `npm run typecheck`, and `npm run build` on 2026-10-09. Build reports the existing large-chunk warning.

Actual local dummy app: desktop keyboard Tab focus and hover on account controls retain `transform:none` / `translate:none`; 120ms feedback uses explicit color/shadow/opacity properties. At 390×844, no horizontal document overflow; reduced motion gives 0s transition. Captured desktop and mobile screenshots under `docs/screenshots/issue-50/`.

Temporary source-based StrictMode harness (removed after inspection): five close/reopen cycles retained one subtree, closing content was inert/aria-hidden, reopening canceled removal, normal exits removed content, reduced-motion activation during exit removed content immediately, and unmount cleaned up. The existing `translateX(-50%)` transform remained unchanged. Scroll helper selected smooth normally and instant under reduced motion; large/negative stagger indices resolved to 120ms/0ms. Selected controls kept their inset ring, disabled opacity remained .55. Initial direct-module harness import used a second React module and errored; the corrected same-Vite-source harness passed. Those errors were isolated to the transient harness.

Feature inventory, production/API behavior, physical touch hardware, and native dialog exit wiring remain unverified here and belong to dependent issues.

## Chat, setup and generation wiring (#52, #53)

Sources: issues #52 and #53, retrieved 2026-10-09. This branch composes canonical follow-up behavior from #84 / #70 and request phases from #82 / #69 with the shared foundation #91 / #50. No backend live stage events or animation dependency are added.

Chat/summary/intro/setup entrances belong to stable logical keys. Editing fields, selecting a shape/preset, moving furniture or refreshing the same room does not remount those blocks. Forward/back navigation keeps values in the existing state and focuses the new step's first usable field/control. Scrolling only follows logical block changes when the reader was within 64px of the bottom; shared scrolling respects the current reduced-motion preference. Submitting a request naturally opens its waiting/result view; no persistent chat history or synthetic streaming is added.

Uploaded and sample photos use stable entry IDs rather than positional keys. Removal immediately affects the active count and request files; one inert, aria-hidden tile remains for the shared exit duration, then leaves the DOM and revokes its object URL. Removing a photo focuses the add control. Returning to a step or interrupting an exit cannot leave active ghost controls. Validation preserves earlier valid photos, deduplicates identical metadata within a batch and retains the four-photo limit. File drag feedback changes the composer surface without remounting fields.

Waiting motion mounts only with the real pending mutation (or the explicitly static `sample-game` route). Decorative active icons and scan loops are separate from readable request-phase status. The existing coarse phases remain upload/analyze/coordinate/preview where applicable. API progress is indeterminate; no percentage, fake completion, timer-driven phase or minimum waiting duration is introduced. The original issue's historical 3/5 sample presentation was already replaced by the canonical #82 coarse-phase contract; this implementation does not reintroduce it. Waiting text comes from the submitted request rather than a potentially stale follow-up field. Stop aborts the request and immediately resets its waiting observer; failure/cancellation restores the input controls and keyboard focus. Navigation aborts the current request and removes decorative loops.

Result chat data appears on response arrival. The existing single RoomViewer remains the only WebGL viewer. Its existing onReady signal now also covers studio rendering: after assets settle and a frame is drawn it reports success or asset failure; WebGL creation failure reports failure immediately. The existing 20-second readiness deadline bounds stalled assets and reports failure, never completion/progress. All timers/renderers are cleaned on unmount. RoomScene fades its viewer once on initial readiness, or reveals the available procedural/error scene with a readable degraded status. Subsequent furniture edits/selections do not repeat the reveal. No second renderer or hidden duplicate canvas is created for transition purposes.

Local lint/build pass; actual browser verification and screenshots are recorded below once the shared browser slot is available. Provider/deployed behavior is outside local fixture evidence.

### Browser verification on 2026-10-09

Actual Chromium from this checkout, using intercepted authenticated room/coordinator/upload/model endpoints and generated PNG files:

- Setup width/shape survived back/forward; the expected input regained focus. Typing and selecting presets preserved user/assistant DOM identities without replaying their entrance animations. Existing reading position did not change when operating the viewer.
- Mixed PNG/GIF input retained two valid PNGs and exposed the invalid filename. Removal made closing tiles inert/aria-hidden/disabled, removed them after exit, revoked the object URL and focused the add control. A five-file attempt retained the four-photo bound and showed the count error.
- Initial creation and both coordinate-form/chat follow-up paths passed real pending fixture → HTTP 500 failure, held response → stop, and immediate retry → fast successful response. Stop restored request input and keyboard focus; waiting displayed the exact submitted text. The progressbar exposed no determinate `aria-valuenow`.
- A canvas-count observer never saw more than one WebGL canvas. One immediate assertion initially observed zero during the existing API-alias verification/refetch handoff; checking the maximum and settled actual readiness confirmed the single-viewer contract. This existing refetch behavior was not changed.
- Live reduced motion disabled setup/photo/thinking CSS animation; photo removal retained no exit tile. Navigating while pending removed the waiting surface and its loops. No unexpected application error was observed; HTTP 500 and WebGL creation errors were deliberately injected fixtures.
- A fresh room with a GLB response held for 25 seconds degraded at the existing 20-second readiness deadline, revealing its usable procedural scene with one canvas and a status note. Forced unavailable WebGL revealed the existing fallback immediately. The first stalled-asset attempt used a persisted earlier scene and sent no GLB request; a fresh API reload supplied the intended fixture and passed.
- Desktop 1440×1000 and mobile 390×844 screenshots were visually inspected. Existing mobile waiting columns squeezed status text; a waiting-only vertical layout now retains the same illustration/status and readable stop button. The mobile document remained 390px wide. The broader result studio layout remains unchanged.

Screenshots and reproduction notes: `docs/pr-evidence/issue-52-53`. Native file drag/drop interaction and physical touch hardware were not exercised; the existing drop handler shares the verified file validation and its feedback is wired in source. Production authentication, provider generation and deployed performance were not verified. No permanent tests were added. Final existing lint/build passed, with the existing large-chunk warning.

## Independent correction (2026-10-09)

Review of PR #102 at `eedcab00f318fc42dca6b5161969b80e382d21fb` found that deleting a sample photo did not restore keyboard focus: only the real-file count triggered the layout effect. The effect now also observes the active sample-photo count, so both kinds of removal focus the existing Add Photo control immediately while the removed tile becomes inert. The motion lifecycle and submitted photo list are unchanged. No permanent tests were added.

## Combined acceptance corrections (#58)

The integration preserves all feature branches through normal merges. Newly introduced template dialogs use the shared native-dialog helper and template cards use stable-key bounded entrance feedback. Template copies remap support-parent IDs and captured world-to-local surface footprints, including inferred-room recentering; copied floor overrides become the existing room floor contract. These corrections keep furniture-surface contact valid across API/offline copies without mutating the source.

At widths up to 720px, the ready studio gives the 3D stage the full width above the chat (280–420px, otherwise 45dvh). New Room hides the uncreated-room illustration and bounds the existing composer scroll area. The earlier 240px chat/150px stage split clipped 3D controls at390px. The generation-specific layout remains independent. Fixed mobile editors use the measured header bottom so wrapped template navigation does not cover their controls. Combined browser acceptance remains pending.
