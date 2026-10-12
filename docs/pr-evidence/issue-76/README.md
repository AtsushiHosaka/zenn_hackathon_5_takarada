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

## Canonical consolidation verification

Verified again on combined application source `08f49170942d9311fee47b5ce540e7d2259a25fe`, which normally merges canonical #104 `3646fc7`, validated manual mirror work, and latest #101 `98f2e09`. Original screenshots above remain historical evidence; the `consolidated-*` and `manual-mirror-controls.png` captures below come from the combined source. Shared Chromium/Vite5174 were reused and released to #54/#55 afterward.

Actual UI against controlled authenticated API responses: select the manual mirror, set 100×200×8cm, add, move X to −40cm and Z to −140cm, rotate, undo/redo, change frame color, save and reload. The same manual UUID, mirror category, dimensions, position, 0° rotation and #595163 frame color were preserved in scoped browser storage. API fixture room dimensions were 4×4×2.4m; furniture geometry and the WebGL renderer were real. Browser local save is distinct from server persistence; a separate rolled-back backend check covered mock generation/database reload/serialization.

- `manual-mirror-controls.png`: actual edit controls and saved mirror.
- `consolidated-manual-front.png` / `consolidated-manual-angle.png`: the manually placed mirror before/after orbit; the latter is zoomed to make the reflected red chair visible.
- `consolidated-trusted-front.png` / `consolidated-trusted-angle.png`: trusted wall_mirror category with colored fixtures.
- `consolidated-trusted-transformed-model.png`: translated/rotated individual glTF surface, fitted before applying the furniture transform.
- `consolidated-trusted-complete-room.png`: complete glTF fixture with mirror metadata.
- `consolidated-two-mirrors.png`: opposing mirrors, with reflective surfaces excluded from nested reflection passes.
- `consolidated-mobile.png`: diagnostic at 390×844. Horizontal scroll width is 390, but the inherited chat split leaves only a 110×94 viewer; this is not a mobile usability pass. #54/#58 own the broader layout work. An initial screenshot was captured before resize settled; the committed capture waits for two animation frames.

Half-float GPU target pixels read from the actual application renderer: manual mirror red/green counts 1,231/1,069 with 1,174 distinct RGB tuples, then 1,187/567 and 896 tuples after orbit. The target resized from 512×437 to 512×438 with the layout. Trusted mirror red/green counts 1,187/1,030 with 1,101 tuples, then 1,140/552 with 824 tuples. Reflected camera coordinates and sampled pixels changed. Imported and complete-model surfaces both resolve to `[0.921, 1, -1.1636269330410536]`; the imported local center is `[0, 1, 0.042]`. Complete-model target values were nonuniform. Trusted-path checks reported zero page errors. Two-mirror instrumentation observed 21 main frames and 21 reflection frames, maximum call depth two, final depth zero and one canvas; no mirror recursion. All new screenshots were inspected.

Temporary CPU checks cover both category IDs, oval geometry, four-way non-origin fitted poses, perspective/orthographic cameras, actual API serialization, renderer-state restoration after an injected render error, auxiliary override-material suppression, bounded resize and disposal. Related existing backend request checks: 13 examples, zero failures; full RuboCop and generated Swagger/types passed. No permanent tests were added; the existing rswag successful input was extended for the additive mirror category.

Production authentication/providers/deployment, physical touch/mobile GPU performance, arbitrary catalog mesh segmentation and complete-model metadata accuracy remain unverified. Other mirror surfaces and editor overlays are excluded from reflections; multiple mirror bounces are not rendered.
