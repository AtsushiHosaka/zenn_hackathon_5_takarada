# Issue #67 browser evidence

Captured from `codex/issue-67-imported-furniture`, using the actual Vite-rendered frontend and Chromium. Desktop: 1440×1000. Mobile: 390×844.

- `image-import-desktop.png`: actual uploaded PNG reference and visible category-model reconstruction limitation.
- `imported-library-desktop.png`: imported URL furniture with its loaded source thumbnail, product details and room placement; the uploaded image entry is in the same library.
- `image-import-mobile.png`: readable import guidance/reference inside the mobile editor overlay.
- `library-search-mobile.png`: name search finds the actual uploaded reference.
- `storage-quota-desktop.png`: forced browser storage quota failure displays an error; prior library data remained byte-for-byte unchanged. The scene was still loading at capture time.

Procedure: authenticate via a local intercepted `/me` response; upload a generated chair PNG; enter name, chair category, 52×88×48cm and model color; import/search/place; move X+10cm and save. Import a desk URL via an intercepted API record twice, verifying one library entry with EC ID 67011 and its actual loaded source image; place/move Z+10cm and save/reload. Confirm exact normalized photo data and source identity survive, and scene IDs remain unique. Switch `/me` to another owner to verify an empty library and reset palette. Force `Storage.setItem` to throw only for library writes and verify error/data preservation. Check mobile keyboard source navigation, close and item-list-to-editor reopening.

API and source-image responses were local fixtures, not live retailer or production-provider evidence. The photo creates an editable category model with user-entered dimensions; it does not reconstruct the photographed object's geometry. Library and uploaded photo persistence are scoped to the user's current browser, connection and API origin.

## Dependency refresh: combined-source browser check

The two `integrated-*.png` screenshots were captured after the conflict resolution `836b01e562b243d27c6e387a76b3a10eda4ba9cf`, from combined local source `932393544fba444d9e87ad99bbe8f336c569f58b`. That source also includes separately reviewed themes, palettes, templates, camera focus and motion branches. These are explicitly combined-source checks, not screenshots of this PR branch alone; the earlier branch-only screenshots above retain their original provenance.

Actual Chromium, one new isolated context on the reused Chrome/Vite processes, passed: upload a real PNG fixture through the file picker; normalize and display it; search by name/fullwidth category; place and move the chair X+10cm; import a URL fixture twice and verify one EC library entry; place and move its desk Z+10cm; save and reload; compare exact image data, dimensions, color, EC identity and unique placement IDs; wait for both matching thumbnail images and the actual viewer readiness. Zero uncaught page errors. Screenshots were visually inspected; the context was closed.

The `/me`, URL-import response and URL-product image are browser fixtures. Upload normalization, library behavior, room editing and browser-local persistence execute the actual frontend source. This does not establish live retailer/provider, deployed authentication or cross-device persistence.
