# Issue #79 review evidence

The screenshots use the actual React/Three.js editor on an isolated browser context against controlled API responses. The room is the existing eight-tatami analysis fixture plus an owned chair; search/import responses provide white and black IKEA-shaped chair records. Prices, IDs, availability, images, and dimensions are fixture data, not live retailer verification. No real account or production data was changed.

1. Click the rendered chair, search its fixed chair category, select a product, and confirm a published color variant through import. [Product selection](select-actual-product.png).
2. Replace the chair and save. The scene contains one black replacement, 46 × 80 × 51 cm, purchase price ¥5,990, and the verified URL. [3D replacement](replaced-chair-3d.png).
3. Reload preserves ecProductId 792, productId 1000000792, existing false, replacesObjectId chair-1, and the original chair replace operation. The purchase panel totals ¥5,990; CSV download is available. Follow-up request contains exactly one chair-1 edit with ec_product_id 792 and chair-1 action replace. The response is deliberately intercepted as a controlled error; browser generation is not a real backend/provider run.
4. Another reversible product selection and undo returns to the saved black chair; the saved original replacement action remains replace. Original-to-replacement undo was observed earlier, before the final undo operation-state fix. Final original-operation reset was reviewed in code, not rerun from a cleared saved overlay.
5. At 390 × 844 the editor has no horizontal page overflow, but the inherited split-pane layout leaves the editor too narrow; responsive layout is tracked separately in #70. [Mobile editor](mobile-replacement.png).

Final manual UI check: add the white product through the existing link palette (owned ecProductId 791), replace it with the verified black product (purchase ecProductId 792), save/reload, and capture the actual frontend request. It retains ec_product_id 791 and sends replacement_ec_product_id 792 for the same manual UUID, with action replace. [Manual replacement after reload](manual-purchase.png). No browser page errors occurred.

Existing checks: 51 RSpec examples pass; Swagger generation 44 examples; frontend API type generation, lint, production build; changed Ruby files pass RuboCop. Build reports the existing large-chunk warning.

A separate rollback-only run on database heyairo_issue_77_79_test verifies suggested SKU/name/URL/price and position retained, owned replacement counted as a purchase with original removed, manual-owned replacement available to the planner and generated, unknown/wrong-category products rejected, preview recoloring accepted, an explicit planner omission not pinned afterward, distinct placement IDs/rotations for two same-SKU groups, and exact storage/tv_stand/wardrobe category parsing and validation. Products and planner responses in this run are controlled; no live Gemini/retailer proof.

Limitations: live search/provider behavior belongs to dependency PR #90 and remains unverified here. Exact meshes depend on verified model metadata; approximate geometry remains labeled by the existing UI. User-selected replacements still obey generation fit, budget, and later instructions.
