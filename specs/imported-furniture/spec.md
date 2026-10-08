# Imported furniture library

Source: GitHub issue [#67](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/67), retrieved 2026-10-09. `docs/project.md` has no Google Docs URL, so the issue and current manual-furniture implementation are the provisional requirements. Google Docs remains unverified and unchanged.

## Acceptance and representation

- Import an actual JPEG, PNG or WebP furniture image. Ask for its name, furniture category, dimensions and model color; retain the normalized actual image as a reference thumbnail. Furniture is represented by the existing editable category model, not automatically reconstructed geometry. The UI explains that choice before import. Dimensions are entered by the user, not inferred as physical facts from a single image.
- Preserve the existing product URL import, official EC identity, dimensions, price and source photo. Successful URL imports also enter the imported-furniture library; repeated imports of the same EC identity replace its library record rather than duplicating it.
- Search imported furniture by name, Japanese/English category, shop or source URL. Search uses the current user's browser library, separate from the official retailer search in PR #90 / issue #77.
- Place image-imported and URL-imported items by clicking or dragging the library card. Use existing floor bounds, move/rotate/size controls, history and room-save behavior. Each placement receives a new manual scene ID while retaining its EC identity or actual reference image.

## Persistence and integration

The searchable library is scoped by connection, API origin and authenticated user ID. Guest users must log in to save/search it. Pending imports and palette inputs do not cross owner changes. Other tabs invalidate the same scoped library when browser storage changes.

Library writes persist before updating the query cache. Quota, disabled-storage, corrupt-storage and maximum-count errors are visible; failed writes preserve the previous library. The library supports at most 30 entries and a serialized 4 MiB character-length bound, with the browser's effective quota also enforced. Images reuse PR #89 / issue #72's normalization: at most 10 MiB input, PNG reference at most 512px and 262,144 data-URL characters. The imported reference is the selected image, not a replacement product photo.

Image reference data is browser-local, retained in scoped saved room edits and the imported library. It is carried onto the same manual IDs when the API regenerates scenes in that browser; no new backend upload endpoint or guessed product identity is introduced. It is not a cross-device photo catalog. Product URL imports keep their existing backend EC identity and do not invent purchase metadata for uploaded images.

This PR stacks on PR #89 so image normalization is shared. The helper was extracted without changing its conversion behavior. The image-goods flow and authenticated API contracts remain those of that dependency. After PR #89 is merged, this PR can be retargeted to main.

## Verification boundaries

Use existing frontend lint/build and temporary browser checks for image identity, category/dimension entry, search, URL identity deduplication, independent scene placement, movement, save/reload, owner isolation and quota errors. No new tests are added under AGENTS.md. Browser fixtures do not establish live retailer fetching or production GCS/Gemini behavior. Complete GLB scenes retain their individual-edit restriction.

## Verified on 2026-10-09

- Existing `npm run lint` and `npm run build`: passed after the final mobile CSS adjustment. Vite retains the existing large-chunk warning.
- Temporary checks against the actual TypeScript storage/domain functions: 14 checks passed, including exact reference data, dimensions/color, owner/connection isolation, EC identity replacement, quota/cache preservation, corrupt/disabled storage, duplicates/count bounds and removal. No test files were committed.
- Chromium from this checkout, with intercepted authenticated `/me` and URL-import API fixtures: a real uploaded PNG was normalized, named and sized as 52×88×48cm; full-width English category plus Japanese-name search found it. Image placement and X+10cm, URL placement and Z+10cm, room save and reload preserved exact reference data, EC identity, source URLs, dimensions and color. Repeated URL imports kept one product entry and each placement had a distinct scene ID. The visible source thumbnails loaded successfully.
- A second authenticated owner saw an empty library and empty URL field. A simulated browser quota exception displayed a save error without changing the existing library. These are local fixture checks, not production authentication evidence.
- Desktop 1440×1000 and mobile 390×844 screenshots were captured and visually inspected. The existing studio columns squeezed the mobile editor; a planner-only viewport overlay at widths up to 600px makes import/search controls readable. At 390px the editor is 374px wide and document width is 390px. Keyboard source navigation, close and the item-list-to-editor reopen path passed.

Evidence: `docs/pr-evidence/issue-67`. Live retailer parsing, deployed authentication, provider operations and cross-device photo persistence remain unverified. Automatic photo-to-geometry reconstruction is not implemented; the UI and this spec expose the category-model representation explicitly.
