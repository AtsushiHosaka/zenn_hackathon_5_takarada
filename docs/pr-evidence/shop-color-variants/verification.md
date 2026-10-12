# Shop color variant verification — 2026-10-12

The user requires real shop color variants, with color selection before furniture/theme shortlisting. No tag-driven preview recoloring is used.

Live refresh of the 92 initial catalog records produced 148 records: 56 additions and 114 records with verified retailer provenance, across 59 reported families. Every verified article key is unique. The audit is `shop-audit.json`; its statuses count individual source/variant operations, not unique products.

Verified examples include IKEA MARIUS blue 30605239 (899 JPY), SANDSBERG blue 40605427 (2000 JPY), KYRRE green 70608132 (2990 JPY), GURLI green 10598758 (399 JPY), and GLADOM light blue 90534003 (1999 JPY). The parent shop color picker establishes the family; each article's own official page establishes its color, price, image and offer status. Structured shop stock status does not prove delivery stock for a particular address.

The scanner reported 20 unsupported original shop rows, six source failures, 14 unsupported color-label operations, three variant-price failures, 13 size-change operations and one unavailable variant. They were not substituted with invented colors or URLs. Current accepted source coverage is IKEA; Francfranc structured groups are supported by the parser but no qualifying current source row was verified. Yahoo Shopping, Nitori, MUJI, KAJA and Rakuten search pages remain outside the accepted fetcher coverage. Unsupported/unverified products cannot automatically fill character-theme slots.

## Validation

- Existing backend request/service examples: 21 passed, zero failures, using the existing API container and a separate test DB. The mounted other checkout and its development DB were preserved.
- Targeted Ruby lint: changed files passed.
- Swagger generated from the request specs; frontend types regenerated from Swagger.
- Frontend full lint and production build passed. Existing bundle-size warning remains.
- Real enriched catalog imported into an isolated test DB: 148 records, 114 eligible verified records, no invalid models/provenance.
- A temporary rollback-only Rails probe exercised real records and the builder with AI disabled: same-family black-to-blue MARIUS resolution before shortlisting; preservation of already eligible selected SKU; own price/URL/color; preferred position/rotation metadata; no unrelated model grouping; stale and conflicting multicolor rejection; original owned scene unchanged. The Miku builder placed nine products, all with verified blue/white sale colors. This is mock planner and actual catalog/builder evidence, not live Gemini quality.
- Importer rollback probes covered stale provenance invalidation, no creation of unsupported products and protection against source checks attached after geometry edits.
- Browser fixture used actual theme tags, palette picker and furniture-search components with real scanned MARIUS data and a stubbed search repository. Miku showed blue/mint/white/green. Switching white/blue changed article URL, photo and color together. The selected-color controls were visually inspected at a 368px browser width without horizontal overflow. No account or saved room was modified. This is component UI evidence, not authenticated API E2E.

## Installation and remaining boundaries

New installations receive the updated seed catalog. Existing databases need the Schemafile columns and the additive `furniture_detail:import_verified_colors` task; the ordinary seed importer intentionally skips a nonempty DB. Export the current DB before future scans to preserve its current geometry/model choices and unrelated/disabled records. Refresh verified source data within 30 days; expired checks stop automatic theme eligibility.

Production was not deployed or modified. Native iOS, checkout, destination-specific delivery stock and live Gemini were not verified. Google Docs are unconfigured and were not updated.

## Release preparation, 2026-10-12

Integrated main `48b5f66` and checked its eight additional source entries. The combined catalog contains 180 source rows, including one retained alias, and 144 verified non-alias records. All source keys were preserved. The eight-row live scan verified seven original IKEA articles plus their sold color variants; the Francfranc source remains unsupported. Full integrated backend suite: 75 examples passed. Full Ruby lint: 142 files passed. Integrated frontend lint/build passed; Swagger and web types regenerated.

The alias is resolved only by the initial DB importer. The additive importer skips aliases, matches existing URLs to preserve product IDs and rejects checks older than current DB evidence. The GitHub and local release paths now explicitly import verified colors on populated databases.

Automated review found two preservation issues before release. Enabled out-of-stock products are now retained by exports, and explicit full snapshot imports preserve supplied evidence when its effective timestamp is unchanged. Rollback probes passed for both and confirmed that ordinary admin edits still invalidate verification. Production baseline schema preflight job `zenn-hackathon-task-89rpj` completed successfully and logged `No change`; the release's schema diff against that baseline contains only five nullable columns and one index.
