# Dialog, authentication, and feedback motion

## Sources

GitHub issues [#56](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/56) and [#57](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/57), read 2026-10-09. Depends on #50's shared CSS and `useMotionPresence` (PR #91). The Google Docs URL in `docs/project.md` is unset; Docs were not checked and these decisions are unreflected there. Scope is web only; preserve layout, identity, authentication, API behavior, and explicit destructive confirmation. No new tests, dependencies, or backend changes.

## #56 acceptance and implementation

- Shared `useMotionDialog(ref, open, requestClose)` retains native `showModal()` focus containment through the 150ms exit. Content and backdrop use shared entrance/exit tokens. Dialog remains the single modal subtree; closing content becomes inert and aria-hidden, focus temporarily remains on the native dialog, and valid connected triggers regain focus after close without moving scroll.
- Escape prevents native premature close and starts the logical close. Outside-rectangle backdrop clicks close the modal; padding clicks do not. Explicit close, native close, interrupted reopen, preference changes, and unmount use the same lifecycle. Delayed native close events cannot close an already reopened dialog.
- Account menu, room rename, and auth notices reuse this hook. Notice kind remains stable during its exit, avoiding text changing to a different notice while closing. Rename form submission still performs the existing save immediately.
- Account deletion remains explicitly confirmed by the existing destructive button. Inline confirmation mounts once, retains its exit as inert/hidden content, initially focuses the safe cancel action, and restores the procedure trigger after cancel/Escape. Busy deletion preserves disabled cancellation and destructive behavior; motion never submits deletion.

## #57 acceptance and implementation

- Login/signup content, account content, auth loading/recovery, missing-room recovery, and app error recovery use consistent opt-in entrances/fades. Recovery actions stay immediately available. Existing route/component keys define logical entrance identity; typing, query refresh, and selections do not remount those surfaces.
- Auth/account/configuration fields use shared focus/border feedback, and their controls use shared control treatments. Existing pending guards, disabled semantics, and authenticated redirects remain unchanged; the account form exposes its real busy state.
- ErrorText uses the actual error message as its logical animation key, preserves role=alert, and does not replay unchanged errors. Validation and actual account success use fades with existing alert/status semantics.
- Studio notices, saved-room/studio persistence warnings, and save-success messages receive a gentle fade. Their existing lifetime and dismissal rules remain unchanged; success still follows the existing successful operation. Positioning transforms remain intact.

## Verification

Passed local lint, typecheck, and build on 2026-10-09 (existing large-chunk warning). Browser inspection used one reused Chromium/session and one owned Vite server, then closed/stopped both.

Checked actual local dummy app at 1440×1000 and 390×844:

- Auth notice Escape, explicit close and backdrop; modal stays native-open during exit, inner content becomes inert/hidden, focus stays contained and returns to the trigger. Testing caught native Tab leaving an empty closing modal; a closing-only Tab handler now retains focus on the native dialog, and the repeated check passed.
- Five rapid close/reopen cycles preserve exactly one modal and usable content. Switching reduced motion on during exit closes immediately. External native `close()` does not reopen. Account-menu close focus and navigation cleanup passed.
- Actual sample-room rename saves immediately, retains exit, then closes; original sample title was restored. Mobile dialog geometry inspected over loaded 3D content.
- Incorrect dummy login shows the real alert. Signup navigation and browser Back work. Typing leaves the current entrance animation identity unchanged.
- Dummy profile pending is aria-busy/disabled with no premature success; actual success appears afterward. Original dummy name restored. Account confirmation initially focuses Cancel, Escape/cancel make exiting controls inert/disabled and restore the procedure trigger. Reduced motion removes it immediately. Destructive deletion was never executed.
- Mobile account/document width has no horizontal overflow. Actual app console errors: zero. Screenshots live under `docs/screenshots/issue-56-57/`.

Not verified: real API/provider authentication/profile errors, persistence-quota runtime warnings, studio save-success branch, app crash/session-recovery runtime branch, physical touch hardware. Those existing feedback branches were source-reviewed; motion only adds CSS classes and preserves their operation/lifetime conditions. The narrow studio recommendation pane remains an existing layout limitation owned by panel/combined-coverage work (#54/#58), not altered here.
