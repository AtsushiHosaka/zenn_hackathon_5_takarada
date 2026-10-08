# Issue #75 evidence

Verified 2026-10-09 using the existing Chromium CDP process and shared Vite port 5181. Each run used a new owned browser context; no other pages, account data, containers, or applications were changed. Google Docs URL is unset.

## Confirmed behavior

- `editor-overlap.png`: actual editor UI with a controlled API-shaped room containing intersecting white/blue chairs. Each complete procedural chair has a red silhouette, including its base; faces keep their original colors.
- `during-drag.png` / `editor-separated.png`: actual pointer drag in top view clears the red outlines and warning before release, then commits X=110 cm. Undo restores the overlap; redo clears it. The final affected drag check ran on scoped source `de60c8e`, based on PR #101 source `98f2e09`, with no page or console errors.
- `mirrored-product-glb.png`: real binary GLB generated for verification, with six chair meshes under a rotated negative-scale node. The loaded chair's seat, back and individual legs receive their full outlines. Mesh material color and negative parent scale were inspected at runtime.
- `complete-room-groups.png`: real binary complete-room GLB with explicit furniture group names/extras. Both chair groups receive their full actual-mesh silhouettes, including legs. The room floor is excluded.
- `partial-ownership-warning.png`: one complete-room furniture group has authoritative ownership, while the other has only a tagged leaf and spatially matched parts. The latter explicitly warns that some parts may have no collision/outline coverage. Partial coverage is never silently presented as a complete check.
- `support-contact.png`: acrylic stand rests exactly on the rendered tabletop at Y=0.6814052104 m, with no overlap warning or red outline.
- `mirror-and-overlap.png`: combined #75/#76 source with a trusted `wall_mirror`. Alpha-only outline passes preserve actual mirror pixels.
- `mobile-bounded-notice.png`: 390 px isolated RoomViewer fixture with five long names. Names are capped to three plus the remaining count. The notice is 48 px high, keyboard focusable and scrollable; no horizontal overflow. Actual editor mobile smoke also confirmed that bound and no page errors. Its inherited two-column layout remains cramped; this is not a full mobile layout redesign.

## Geometry and GPU checks

Twelve temporary geometry checks passed: overlap/separation, exact surface contact, 1 mm rounding, mirrored scale, rotated OBB versus misleading AABB overlap, transformed local centers, empty space between separate table parts, tabletop penetration/contact, hidden meshes and instances. Four temporary complete-room mapping checks passed: explicit IDs/extras, unique spatial ownership, rejection of ambiguous ownership, and exact mirrored/nonuniform world transforms.

The combined GPU comparison changed 2,966 pixels (0.206% of a 1440×1000 frame), including 1,366 red edge pixels. Background RGBA stayed `[22,20,28,255]`. The wall-mirror target contained 1,589 distinct values and was bit-identical before and after auxiliary outline passes. The existing mirror GPU harness also passed orbit, translated/rotated loaded-model and complete-room checks with `wall_mirror`, without page errors.

Combined GPU evidence used local verification source `f29156a` (normal merges of #76 source `d88176f` and #78 source `932d8e41`, plus the final #75 renderer/ownership/mobile fixes). The later #78 change `98f2e09` affects support metadata and edit validation; its affected drag smoke passed on `de60c8e`. No shader/ownership implementation changed in that dependency update. The temporary standalone fixture document emitted Vite HMR websocket warnings; these are distinct from application/WebGL errors. The actual editor run had neither.

## Validation and boundaries

Frontend lint/build and `git diff --check` passed. No new repository tests or API contracts were added. Independent review of immutable `98f2e09..de60c8e` found no blockers.

Controlled room responses and generated GLBs verify editor/rendering behavior, not authenticated production, live EC/Gemini, or deployment. Oriented per-mesh bounding volumes are conservative for hollow/curved meshes; they are not exact triangle collision. Complete-room assets need explicit group ownership for full coverage; ambiguous, unowned or partial legacy assets retain a visible warning. Support contact tolerates up to 3 mm of rounding/penetration.
