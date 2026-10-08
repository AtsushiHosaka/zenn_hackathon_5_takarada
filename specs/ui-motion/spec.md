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
