# Product photos in recommendations and furniture search (#60, #68)

Source: GitHub issues #60 and #68, read on 2026-10-09. The Google Docs URL in `docs/project.md` is unset; no Docs verification is claimed.

## Acceptance

Recommendation thumbnails show each item's product photo when available. Furniture search cards and the selected variant preview show the corresponding verified product photo. Missing or failed images retain a usable card without substituting another product's photo.

## Existing implementation and dependencies

`InteriorLinks::ProductParser` selects the verified Product's image before official page social-image fallbacks. `FurnitureImport.scene_attributes`, search serialization, and frontend record decoding preserve that URL together with the product's EC identity and source URL. Recommendation cards render `item.imageUrl` with a keyed image-error fallback. PR #90 adds search cards and re-imports the chosen official variant; PR #97 (#79) adds search photo error/missing-image fallbacks.

## Verification inventory

- Compare official white, black, and blue IKEA GLADOM fixture product identities, source URLs, and distinct image URLs with search/card and recommendation data.
- In the app, search table category, inspect each photo/name pairing, select a result and its variant, and inspect the selected photo.
- Inspect recommendation photo/name pairing, purchase link, and category filtering.
- Check broken images and absent images without losing selection or rendering another product's photo.
- Check changed search conditions hide prior cards until the new search finishes.
- Capture screenshots and report whether retailer requests and API responses are controlled fixtures or live.

No new tests are added. Live grounded search and production fetching are separate verification boundaries.

## Result

All listed checks passed using controlled official-HTML-derived API responses and live IKEA image loads. Five visually inspected screenshots and source/verification boundaries are in `docs/pr-evidence/issues-60-68/README.md`. The exact integrated frontend was checked at `6e266b4`; final dependency `308d38cc` includes the reviewed backend grouping fix and refreshed replacement evidence, with frontend photo code unchanged. No application change or new test was necessary in this PR.
