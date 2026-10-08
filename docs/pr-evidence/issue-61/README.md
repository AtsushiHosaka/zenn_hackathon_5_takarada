# Issue #61 UI evidence

Captured 2026-10-09 JST from this PR's local Vite app, in an isolated browser context using dummy saved-room fixtures. Production and real API connections were not exercised.

- `carousel-desktop.png`: 1440×1000, first room, title, known purchase total, room text and estimated floor plan.
- `carousel-next.png`: 1440×1000, next room, measured geometry and matching floor plan.
- `carousel-mobile.png`: 390px mobile view of the second room; full-page capture includes the floor plan below the fold.

Browser verification passed empty-state/new-room navigation, arrows in both directions and wrapping, keyboard selection, room opening, metadata synchronization, one mounted canvas, missing-price explanation, single-room disabled arrows and no horizontal overflow or page errors. Fixtures were staged in local browser storage; all navigation/selection signoff used the visible controls.
