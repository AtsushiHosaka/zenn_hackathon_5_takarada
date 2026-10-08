# Mirror reflections

Source: GitHub issue #76 (low priority), read 2026-10-09. Google Docs URL is unset in `docs/project.md`; issue requirements are recorded locally.

## Acceptance

- Mirror furniture reflects the contents of the 3D room.
- The reflected view changes with the viewing angle.
- Reflection follows mirror position/rotation and is available for procedural mirrors, individual catalog models, and complete room models with mirror metadata.
- Existing selection, movement, Before/After, surface placement and room previews remain usable.

## Decisions

Use Three.js Reflector with a reflected camera and clipping plane, rather than a static image. A rectangular glass surface fits the front of the mirror; published round/oval shape metadata chooses an elliptical surface. Model surfaces use the loaded model bounds. Complete room models use the same item coordinates as their selection targets.

Reflections are limited to one recursive render level; other mirrors can show their existing reflection texture without triggering unbounded mutual renders. Auxiliary material-override passes do not update reflection targets. Each target is 512 by 512 without MSAA and is disposed with its surface.

The change is frontend-only. No API, DB, iOS or deployment changes. Catalog model/front-face and complete-model surfaces are geometric approximations; no material-name or mesh segmentation contract exists.

Primary API reference: https://threejs.org/docs/pages/Reflector.html; installed Three.js 0.186 source inspected.

## Verification

Frontend lint and production build passed. Existing build chunk-size warning remains. Reflection runtime and screenshot evidence are pending.

Trusted wall_mirror and legacy mirror categories are accepted for procedural, imported and complete-model paths. Independent temporary exact-source Three.js probes verify both categories, translated four-way fitted-model poses, target disposal, and recursion/override-material suppression with controlled render hooks. Frontend lint/build pass; reflected pixels and view changes require the author's final browser evidence. No permanent tests added.
