# Chat/setup/generation motion evidence (#52, #53)

Actual Chromium screenshots from this checkout, using local intercepted authenticated `/me`, room, coordination, signed-upload and furniture-model routes. Room responses were generated from the existing TypeScript analyzed-room fixture; coordinator responses were explicit local records. Uploaded PNGs were generated fixtures. No live provider generation is claimed.

Desktop 1440×1000:
- `setup-photos-desktop.png`: stable width/shape summaries, four retained valid photos and explicit count error.
- `pending-initial-desktop.png`: held initial request; real coarse phase and indeterminate bar.
- `pending-followup-desktop.png`: held coordination; exact submitted request text.
- `ready-initial-desktop.png`: response received and existing single 3D viewer ready.
- `readiness-degraded-desktop.png`: stalled GLB hits the 20-second readiness failure bound, then reveals the available procedural scene/status.

Mobile 390×844 with reduced motion:
- `setup-reduced-mobile.png`: photo removed immediately, count zero and focus on add control.
- `pending-reduced-mobile.png`: stable readable waiting text, stop button and same illustrative preview in the responsive waiting layout.

Verified setup back/forward values/focus; typing/preset DOM identity and entrance stability; mixed valid/invalid files; inert exit retention, URL revoke and count limit; initial/coordinator/chat HTTP failure/held response/stop/fast retry; submitted text, input/focus restoration, single-canvas maximum; reduced-motion loop removal; navigation cleanup; stalled assets and unavailable WebGL fallbacks. Direct native drag/drop, physical touch, production authentication/provider behavior and deployed performance were not exercised. No new permanent tests.

A first instant canvas-count assertion caught a transient zero during existing API-alias refetch, not multiple viewers; a maximum-count observer and settled readiness check passed. A first stalled-asset attempt used an older persisted scene; a fresh API reload requested the intended GLB and passed. Two HTTP 500 responses and WebGL errors were injected intentionally. An old held route also timed out in the temporary fixture harness after navigation; this was not an application failure.
