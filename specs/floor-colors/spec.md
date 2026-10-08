# Editable floor color (#59)

Source: GitHub issue #59, 2026-10-09. Google Docs URL is unset; Docs is unverified and these decisions have not been reflected there.

The layout editor offers the existing color swatches and a native custom color picker for the floor. It uses the same immediate editing, undo/redo, dirty-state and save flow as wall color. Measured room geometry stores its floor color; an optional validated hex override covers legacy inferred/sample rooms. The viewer applies the override to floor surfaces and keeps floor joints visible. Before restores the original snapshot or legacy floor materials; After restores the edit. Floor edits do not alter furniture colors or the podium.

Local saved-room storage validates the override and preserves it across reload. Server-side floor mutation/regeneration and iOS floor editing are not introduced. Completed room GLBs keep the existing disabled architectural editing behavior because their floor is not a separately identified surface.

No API, DB or environment contract changes. API room geometry already includes floor_color. Template reuse of measured scenes uses that existing color.

Verification: frontend lint/build passed. Temporary checks using actual Three.js floor descriptors verified saved/invalid hex values, recolored sample floor faces, unchanged walls and original Before colors. Browser fixtures verified actual measured-floor material updates, swatches, a custom color through one DOM input event, undo/redo, original Before/edited After, save/reload, and mobile keyboard activation without horizontal overflow. Screenshots are in docs/pr-evidence/issue-59. The native operating-system color dialog, physical touch and deployed/provider paths remain unverified. The mobile editor panel expansion is handled by the separately stacked mobile editor PRs.

Shell GLBs apply an explicit saved floorColor only to confirmed upward horizontal floor triangles in the supplied room bounds, within 3cm of Y=0 and covering 50–105% of the floor area. A thin 1mm overlay preserves original wall/furniture/model materials and coordinates. Missing geometry or insufficient/duplicated coverage retains the model and reports that its floor could not be identified. No semantic mesh/material names are assumed. Before and clearing the override remove the overlay; existing scene cleanup disposes it. Instanced/skinned shell geometry is not classified as a floor.

Shell follow-up verification: frontend lint/build and exact-source Three.js checks pass separate/combined floor-wall meshes, 0/90/180/270-degree and reflected roots, preserved original materials, upward winding, geometry/material disposal, and raised/tiny/out-of-bounds/duplicated/no-floor rejection. The overlay only follows explicit saved overrides; Before/clear/no-match notice wiring was checked in source. Actual GLB pixels and UI persistence need browser evidence at the final integrated head. No permanent tests added.

The floor classifier stops after 100,000 triangles. Larger or unconfirmed shells retain their source materials and show the unavailable-floor notice only in the edited view.

Integrated actual browser verification at root6b87b371 passed shell floor GPU recoloring with unchanged wall pixels/source material/geometry, override clear via undo, redo/custom/save/reload, original Before and edited After, 390px panel keyboard/save/close, no-match notice and procedural floors. Controlled GLTF fixtures were used; arbitrary provider geometry and deployed paths remain unverified. Evidence is recorded in docs/pr-evidence/issue-59/README.md.

Legacy analysis rooms without a Before snapshot retain room.floorColor as the original floor; the editor changes only the explicit design.floorColor override. Measured floor faces and joints restore that original color in Before. A legacy shell retains the actual loaded model in Before and hides its overlay, preserving original model pixels rather than substituting procedural architecture. Existing explicit Before snapshots keep their existing semantics. Previously saved edits that overwrote room.floorColor cannot recover an unknown original color.
