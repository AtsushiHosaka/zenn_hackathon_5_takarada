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

Frontend lint and production build passed. Existing build chunk-size warning remains. A temporary isolated browser check reused the existing Chromium and rendered controlled saved-room/glTF fixtures with the actual WebGL renderer. GPU reflection pixels include the red chair and green shelf; orbit changes both the reflected camera and texture pixels. Translated/rotated individual glTF surfaces and complete-room metadata surfaces align with their furniture. No page errors occurred. See `docs/pr-evidence/issue-76/README.md` for captures and verification boundaries.
