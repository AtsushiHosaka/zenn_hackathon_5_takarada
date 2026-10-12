# Smooth wall cutaway rendering

Source: user request and attached room screenshot, 2026-10-12. The Google Docs URL in `docs/project.md` is unset; Docs remains unverified and this change has not been reflected there.

## Acceptance

- When orbiting a room, a near wall fades smoothly between its solid state and the existing 12% cutaway opacity.
- Wall-mounted artwork and theme motifs remain stable instead of flickering as the viewing angle changes.
- All four measured walls, legacy procedural walls, reference-room walls, preview rendering, camera controls, and Before/After retain their existing behavior.

## Decisions

Use a 280 ms smoothstep fade inside the existing render loop, with an 8 cm hysteresis band around the existing camera-side threshold. Reversing direction begins from the last rendered opacity. Initialize the wall state directly at the correct opacity so mounting a preview does not flash solid walls. Continue rendering previews until their fades settle; initial snapshots wait for settled walls. Respect the current reduced-motion preference.

Cache wall materials once. Fading walls do not write depth; fully solid walls restore their original transparency, opacity and depth settings. Furniture visibility is not tied to wall visibility. Window frames stay at their physical locations as before. No extra production canvas or render loop is introduced.

Render uploaded poster/acrylic artwork as alpha-tested surfaces with MSAA alpha-to-coverage, preserving cutout edges while removing their dependence on transparent-object sorting. Poster faces receive 2 mm clearance and a small polygon offset from their backing. Give overlapping theme motif pieces deterministic 1 mm local depth separation. Imported GLB materials and baked complete-room models are unchanged; arbitrary intersections inside imported assets are outside the evidence for this fix.

Material reference: https://threejs.org/docs/pages/Material.html, checked 2026-10-12, plus the installed Three.js implementation.

## Verification

Frontend lint and production build pass. The inherited bundle-size warning remains. Browser verification uses the actual RoomViewer and WebGL renderer with a temporary controlled local fixture matching the screenshot's measured walls, music motif, poster, acrylic stand, window and furniture. No permanent tests are added. Production deployment and the exact saved room's imported assets have not been verified.

Temporary exact-source checks passed for all four wall orientations (28 checks): initial solid state, 140 ms midpoint, exact 280 ms endpoint, threshold hysteresis, interrupted-fade continuity, reverse endpoint, and reduced-motion restoration. A complete browser orbit produced 155 actual intermediate-opacity frames; a preview orbit produced 129. Preview walls reached exact 1 / 0.12 endpoints, and rendering stopped at frame 9390 after settling. Poster/acrylic artwork used depth-writing alpha-tested materials, motif depths were distinct, one canvas remained mounted, and no page errors were observed. These numbers describe the local controlled fixture, not a production benchmark.

The browser preview reversal check also settled after 91 additional intermediate frames. Top/front/perspective, reset and Before/After were exercised successfully. A simulated reduced-motion preference is checked separately; it does not change the user's OS preference. Captured fixture metrics and a screenshot are saved under `docs/screenshots/wall-rendering/`.

The reduced-motion browser orbit contained zero intermediate-opacity frames. Ribbon motif layers were 0, 1 and 2 mm with one canvas and no page errors. The temporary harness and tab were removed after verification; the production app contains no instrumentation.
