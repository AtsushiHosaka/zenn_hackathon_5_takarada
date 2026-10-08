# Saved-room carousel

Source: [GitHub issue #61](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/61), read 2026-10-09 JST. `docs/project.md` has no Google Docs URL; shared Docs remain unverified and unmodified.

The home page replaces the saved-room grid with a single large 3D preview. Previous/next buttons wrap through saved rooms and switch the title, furniture price, size/shape text, and floor plan together. There are no tags. The new-room link stays available above the carousel and in the empty state.

Selection uses the saved-room ID, so background list reordering preserves an explicitly selected room. Only the selected room mounts a preview; changing slides disposes the previous renderer through the existing viewer lifecycle. No automatic slide changes. The focusable carousel also accepts Left/Right arrow keys. One-room lists disable both arrows; pending and failed rooms show their own status without stale room details.

Furniture totals cover items being bought, excluding existing furniture whose purchase price is unavailable. A missing product price makes the displayed amount a confirmed subtotal with an explicit missing-price count. Room dimensions use saved geometry and supplied shape/tatami. Legacy rooms without geometry/input show that their size and shape are unregistered; their inferred floor plan is labeled as an estimate. Floor plans project saved item positions, dimensions and rotations into the room bounds. The existing perspective fit margin is retained for preview cameras to avoid cropping narrow views.

## Verification

- Existing frontend lint and production build pass. The existing large-bundle warning remains.
- Browser checks use an isolated context of the existing Chromium process and local dummy fixtures. They cover empty state, previous/next and wrap, keyboard navigation, linked room/new-room navigation, synchronized title/size/map, one canvas per slide, missing prices, one-room disabled controls, and 390px mobile overflow. No page errors occurred.
- Screenshots at `docs/pr-evidence/issue-61/` show desktop first/next slides and a 390px mobile view. The measured-room sample uses the existing analysis fixture and a sample product; these are local UI evidence, not live API or production data.
- API, DB, environment variables and iOS are unchanged. Deployed/authenticated real-room rendering is unverified.
