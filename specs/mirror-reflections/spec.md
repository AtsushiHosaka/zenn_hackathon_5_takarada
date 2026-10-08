# Mirror reflections

Source: GitHub issue #76 (low priority), read 2026-10-09. Google Docs URL is unset in `docs/project.md`; issue requirements are recorded locally.

## Acceptance

- Mirror furniture reflects the contents of the 3D room.
- The reflected view changes with the viewing angle.
- Reflection follows mirror position/rotation and is available for procedural mirrors, individual catalog models, and complete room models with mirror metadata.
- Existing selection, movement, Before/After, surface placement and room previews remain usable.

## Decisions

Use Three.js Reflector with a reflected camera and clipping plane, rather than a static image. A rectangular glass surface fits the front of the mirror; published round/oval shape metadata chooses an elliptical surface. Model surfaces use the loaded model bounds. Complete room models use the same item coordinates as their selection targets.

Other mirror surfaces, editor markers, selection helpers, placement previews and grids are excluded during reflection passes, preventing recursive mirrors and stale reflected mirror textures. Auxiliary material-override passes do not update color reflection targets. Each target retains the viewer aspect ratio with a 512px per-axis cap and no MSAA; targets resize with the viewer and dispose with their surfaces. Visibility, XR, shadow refresh and render-target state restore even after a thrown reflection pass. Linear 0.5 overlay tint preserves original reflected colors.

Manual mirrors can be added from the existing furniture palette, with existing dimensions, move, rotation, frame color, undo/redo and save controls. Add mirror only to the existing manual FurnitureEdit contract and backend whitelist; regenerate Swagger and frontend types. Purchase categories, endpoints, DB and environment are unchanged. iOS reflection rendering remains unimplemented. Catalog model/front-face and complete-model surfaces are geometric approximations; no material-name or mesh segmentation contract exists.

Primary API reference: https://threejs.org/docs/pages/Reflector.html; installed Three.js 0.186 source inspected.

## Verification

Frontend lint and production build passed. Existing build chunk-size warning remains. A temporary isolated browser check reused the existing Chromium and rendered controlled saved-room/glTF fixtures with the actual WebGL renderer. GPU reflection pixels include the red chair and green shelf; orbit changes both the reflected camera and texture pixels. Translated/rotated individual glTF surfaces and complete-room metadata surfaces align with their furniture. No page errors occurred. See `docs/pr-evidence/issue-76/README.md` for captures and verification boundaries.

Trusted wall_mirror and legacy mirror categories are accepted for procedural, imported and complete-model paths. Independent temporary exact-source Three.js probes verify both categories, translated four-way fitted-model poses, target disposal, and recursion/override-material suppression with controlled render hooks. Frontend lint/build pass. Existing browser captures use legacy mirror fixtures; trusted wall_mirror browser verification at the integrated head remains pending. No permanent tests added.

## Consolidated manual placement verification

Merged the independently validated manual mirror implementation into canonical PR #104. Frontend lint/build, 13 existing room/coordination request examples, full RuboCop and Swagger generation (41 dry-run examples) passed. The existing successful rswag fixture includes a mirror; no new tests were added. Temporary actual-adapter checks preserve mirror category/identity and center-to-floor coordinate conversion. A rolled-back real local DB check preserves category, position, rotation, size and color through validation, mock generation, reload and serializer. Temporary Three.js checks include rotated/transformed mirrors, perspective/orthographic views, recursive/overlay exclusion, override-material suppression, exceptional renderer-state restoration, bounded resizing and disposal. Final combined-source browser checks passed for manual add/move/rotate/undo/redo/color/save/reload, trusted wall_mirror procedural/individual-glTF/complete-metadata paths, camera-dependent GPU pixels and two-mirror depth bounded to two. One canvas remained mounted. The 390px diagnostic shows the inherited tiny viewer layout; it is not a mobile usability pass. Screenshot/source metrics and verification limits are recorded in the evidence notes.
