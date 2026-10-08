# Furniture product replacement — #79

Source: [issue #79](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/79), read 2026-10-09 JST. Google Docs URL in docs/project.md is unset; Docs was not read or updated. The issue and authorized user request are the provisional source.

## Acceptance

- Clicking furniture in the room opens its editor and a search limited to the same category.
- Selecting a freshly verified actual product replaces that object and updates the 3D view, dimensions, color, model information, product URL, and purchase price.
- The category remains unchanged, such as chair A to chair B. Server validation rejects nonexistent products and products from another category.

## Decisions

- Reuse #77 / PR #90 search and verified import contracts; this PR closes only #79. Published color-variant selection stays in #77.
- Import `purpose: replacement` permits parser-supported decor categories as well as the nine detected floor-furniture categories (including storage, TV stands, and wardrobes); ordinary manual additions retain their existing floor-only restriction. Decor replacements preserve the current bottom elevation; floor furniture is grounded and bounded by the room. Full scans containing baked furniture cannot edit individual objects.
- Replacement is a new purchase (`existing: false`) and retains the original object ID in `replacesObjectId`. Original replacement operations and before/after snapshots persist atomically. Purchase totals, recommendations, and CSV include it.
- Suggested products carry trusted EC identity in edited_objects through follow-up generation. Manually added ownership retains its original ec_product_id and uses separate replacement_ec_product_id; ownership/category constraints stay enforced.
- Selected products become planner candidates and previous choices, without overriding its final selection. A later prompt can remove or change them; budget and fit can also exclude them with existing notices.
- Preview recoloring remains independent of sold variant identity. Official product metadata comes from the catalog, while layout color is a preview edit. Missing or failed photos show a fallback.
- No DB migration, environment change, deployment, or new automated tests. OpenAPI/TypeScript are generated from the existing schema definitions.

## Verification

See [review evidence](../../docs/pr-evidence/issue-79/README.md). Real Gemini, retailer availability, and production were not verified.
