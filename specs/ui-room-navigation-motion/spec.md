# Saved-room navigation and preview motion

## Sources and integration

GitHub issue [#51](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/51), read 2026-10-09. Depends on shared foundation #50 / PR #91. Existing room-list replacement #61 / PR #86 changes the original grid into a single-preview carousel; this implementation preserves that newer behavior instead of restoring the grid. Google Docs URL is unset in `docs/project.md`; Docs were not checked or updated.

## Acceptance and decisions

- New Room remains a native React Router Link to `/rooms/new`. Shared hover/focus/press feedback changes no geometry, introduces no request/navigation timer, and never creates a persisted room on activation. Keyboard, modifier clicks/new tabs and Back retain native behavior.
- Carousel arrows and room-open links use the shared feedback. The selected slide's existing stable room ID controls its scene identity. Details now share that ID as their key; slide/details content enters when selected content appears, while unchanged query refreshes preserve the mounted logical block and do not replay motion. Only one slide is mounted, so stagger is 30ms for the detail group (within the shared 120ms cap).
- Hover/focus emphasize the carousel border/shadow without moving the card, arrows, focused controls or plus glyph. Existing layout and purple identity are retained.
- The existing single RoomPreview/RoomViewer reveal fades only after actual `onReady` feedback; placeholder/error status and IntersectionObserver cleanup/idle rendering remain unchanged. No overlay copy or second canvas/viewer is introduced.
- The new studio header enters once and its input composer fades once. Logical intro/setup-step transitions remain owned by #52 to avoid applying two entrances to the same question. These combined destination treatments fulfill the header/intro/input inventory across #51 and #52.
- Reduced motion uses the shared CSS policy; controls/navigation remain immediate.

## Verification

- Existing frontend lint, TypeScript checking and production build passed after removing the parent scene fade. The build retains its existing chunk-size advisory. No tests or dependencies were added.
- Actual local dummy app at 1440×1000 and 390×844: mouse/keyboard New Room activation, native Meta-click background tab, Back and browser-emulated touch worked. Activation left persisted rooms unchanged and destination input was immediately enabled/focusable. Hover retained the exact button rectangle; mobile carousel/plus/arrows fit with document width 390. Reduced motion produced 0s durations for details, ready preview, header and composer.
- Actual demo fixtures: carousel mouse/ArrowRight movement mounted at most one canvas. New-studio navigation and scrolling the preview offscreen removed it; returning onscreen mounted one. Only the ready child carries the preview fade.
- Temporary source harness rendered real RoomList/RoomPreview with controlled repository results: loading, empty, analyzing and failed copy remained correct, no ready viewer appeared for analyzing/failed records, and single-room arrows remained disabled. Query refresh with unchanged ID preserved the exact detail node, motion-enter animation object and start time; stagger was 30ms. The harness was removed before commit.
- Screenshots are actual app renders from this checkout under `docs/screenshots/issue-51`. Local storage data were demo fixtures, not production room results. Browser console contained no application errors.
- Not verified: live API/provider/production behavior, physical touch hardware, authenticated backend-created pending/failed rooms. Local source harness coverage does not substitute for those integrations. Intro/setup transitions require #52; this PR intentionally owns only destination header/composer and carousel motion.
