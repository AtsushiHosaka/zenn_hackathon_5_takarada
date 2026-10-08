# Issue #67 browser evidence

Captured from `codex/issue-67-imported-furniture`, using the actual Vite-rendered frontend and Chromium. Desktop: 1440×1000. Mobile: 390×844.

- `image-import-desktop.png`: actual uploaded PNG reference and visible category-model reconstruction limitation.
- `imported-library-desktop.png`: imported URL furniture with its loaded source thumbnail, product details and room placement; the uploaded image entry is in the same library.
- `image-import-mobile.png`: readable import guidance/reference inside the mobile editor overlay.
- `library-search-mobile.png`: name search finds the actual uploaded reference.
- `storage-quota-desktop.png`: forced browser storage quota failure displays an error; prior library data remained byte-for-byte unchanged. The scene was still loading at capture time.

Procedure: authenticate via a local intercepted `/me` response; upload a generated chair PNG; enter name, chair category, 52×88×48cm and model color; import/search/place; move X+10cm and save. Import a desk URL via an intercepted API record twice, verifying one library entry with EC ID 67011 and its actual loaded source image; place/move Z+10cm and save/reload. Confirm exact normalized photo data and source identity survive, and scene IDs remain unique. Switch `/me` to another owner to verify an empty library and reset palette. Force `Storage.setItem` to throw only for library writes and verify error/data preservation. Check mobile keyboard source navigation, close and item-list-to-editor reopening.

API and source-image responses were local fixtures, not live retailer or production-provider evidence. The photo creates an editable category model with user-entered dimensions; it does not reconstruct the photographed object's geometry. Library and uploaded photo persistence are scoped to the user's current browser, connection and API origin.
