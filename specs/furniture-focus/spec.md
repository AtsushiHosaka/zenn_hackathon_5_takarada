# Furniture camera focus (#71)

Source: GitHub issue #71, 2026-10-09. Google Docs URL is unset; Docs is unverified and these decisions have not been reflected there.

A click/tap on a visible furniture object moves the existing camera's orbit target to that object's rendered bounding-box center and fits it with a 25% margin. Perspective and orthographic viewers keep their current viewing direction. No camera interpolation or extra render loop is introduced, so reduced-motion preference has no camera travel animation. Existing selection feedback becomes an opaque purple bounding outline visible through occlusion, plus the selected object's name in a keyboard-activatable focus button and the canvas description. Choosing another object replaces the target and the single outline.

Dragging retains immediate pointer movement and does not refocus on release. Product hover highlights do not move the camera. Preview cards do not get focus controls. Reset/view-switch returns to room framing and restores its zoom limit. Camera state, including the focused minimum distance, survives scene edits; no second canvas is mounted.

Acceptance: actual canvas click/tap focuses the selected furniture; selection is identifiable; subsequent object selection changes focus; dragging remains possible; perspective/orthographic focus and reset work.

Verification: existing frontend lint/build passed. Local browser checks using API fixtures passed actual rendered bed/shelf clicks, single selection helper/canvas, projected object center and perspective fit, movement without camera refocus, keyboard focus, reset, reduced motion, and orthographic focus/zoom/reset on the sample room. Screenshots are in `docs/pr-evidence/issue-71/`. Temporary camera instrumentation was removed before committing. Live provider and deployed behavior remain unverified.
