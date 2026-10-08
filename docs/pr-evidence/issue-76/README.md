# Issue #76: angle-dependent mirror reflections

Verified 2026-10-09 on local Vite using the existing Chromium in a separate context. Saved rooms and glTF meshes are controlled fixtures; the application and Three.js WebGL renderer are real. No production data or live model provider was used.

- `reflection-front.png`: procedural mirror reflects the room.
- `reflection-angle.png`: toolbar camera rotation changes the reflected view.
- `reflection-transformed-model.png`: loaded glTF mirror at `[0.9, 1, -1.2]`, rotated 30 degrees, keeps its reflection surface aligned.
- `reflection-complete-room.png`: complete glTF room uses mirror item metadata to place the reflection plane.

The GPU render target contained 1,411 distinct RGB tuples, including 1,388 red and 1,208 green pixels from fixture furniture. After orbit, the target changed to 1,077 distinct tuples. Reflected camera coordinates and sampled texture pixels changed. The loaded model's local surface center was `[0, 1, 0.042]`; its world center was `[0.921, 1, -1.1636269330410536]`, matching the item transform. The complete-room surface matched the same world center and rendered nonuniform pixels. No page errors occurred. All four captures were inspected.

Temporary CPU checks exercised actual Reflector camera math, target restoration, auxiliary-pass and recursive-render guards, and render-target disposal. These checks were not added as permanent repository tests.

Frontend lint and production build passed. Existing bundle-size warning remains. Shape/front-face fitting uses geometric bounds and published shape metadata; arbitrary catalog mesh segmentation and arbitrary complete-model metadata alignment are not separately verified. GPU performance on mobile hardware and deployed behavior are unverified.

## Trusted category integration follow-up

The shared browser was independently checked at combined root head `7405e537a260f0550aaa90883f9c1f4cc314924b`, including this PR source `d88176f46062a7f96c61f0706fe6a57303aa0be0`. Controlled fixtures use the actual trusted `wall_mirror` category in procedural, imported glTF, and complete-room paths. `trusted-integrated-angle.png` and `trusted-integrated-transformed-model.png` show the actual application/WebGL output and were inspected. The GPU target changed from 1,411 to 1,077 distinct RGB tuples after camera orbit; imported and complete model surface centers aligned at `[0.921, 1, -1.1636269330410536]`, with 114 colors in the complete-room reflection. There were no page errors. The source was unchanged for these captures; only temporary verification instrumentation was used and removed. This confirms the trusted category pixel path with synthetic geometry, not arbitrary catalog mesh alignment, deployed/provider behavior or mobile GPU performance.
