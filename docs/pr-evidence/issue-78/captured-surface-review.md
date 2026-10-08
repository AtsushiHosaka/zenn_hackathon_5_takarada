# Captured round surface follow-up (#78 / PR #101)

Browser source: combined local integration `6b87b371ab2a4bc3e2eca701e3f82f4538c5311b`, containing PR #101 patch `98f2e095716a304f9bbeb36284535e7924c3e8aa` plus other open PRs. These screenshots are evidence for that integration, not an isolated PR-branch browser run.

A fresh Chromium context reused the existing app on port 5173 and browser on port 9222. Its controlled dummy room contains an actual procedural 60 cm round table and a 20 cm stand. Temporary per-context module-response instrumentation exposed only camera projection and current design for deterministic pointer coordinates and assertions. The scene rendering, ray-picking, drag events, editing controls, persistence, and screenshots use the actual application. No on-disk instrumentation or additional app/browser/container was created. The context was closed afterward.

Passed browser actions:

- Drag the stand onto the tabletop: capture actual cylinder radius 0.3 m and normalized rendered surface height 0.7310108499290806 m; exact stand center is 0.8310108499290806 m. The aggregate item height is not substituted for the rendered tabletop.
- Save/reload: restore the same support ID and bounded transform/bounds/radius/contact/snapshot profile.
- Use X/Z movement controls from (-10 cm, -10 cm) through supported positions to (20 cm, 10 cm): the corner leaves the circular footprint, so center height becomes 10 cm and both support metadata fields clear.
- Resize width to 60 cm: footprint no longer fits, so the stand returns to the floor and clears metadata.
- Resize to 30 × 20 × 10 cm, drag to (0 cm, 20 cm), and rotate 15 degrees: the newly rotated corner exceeds the radius, so the stand returns to the floor and clears metadata.
- Retain one viewer canvas with no page errors. Toolbar zoom was used to make the feature screenshots clearer.

`round-surface-contact.png` shows the actual captured tabletop placement; `round-surface-keyboard-floor.png` shows the stand below the table after the X/Z edge move, with X 20 cm / Z 10 cm in the panel. The earlier four screenshots belong to source `932d8e4` and cover desk/shelf/drop/floor interactions before this follow-up.

Source checks: frontend lint/build passed (existing bundle-size warning); 15,552 temporary actual captured-affine/circular corner cases matched an independent Three.js corner oracle. Rectangular mesh identity, resize, rotation, untouched-axis retention, persistence, changed/deleted supports, legacy profile absence, invalid size/coordinates and 12 malformed-profile cases passed. No new permanent tests or backend contract changes.

The profile is browser-local editor metadata. The existing API edited-item path still persists vertical placement; this run used dummy storage, not authenticated Rails/provider/deployed proof. Moving a support does not carry its contents. Older support IDs without a profile safely return to the floor on the next edit and can be recaptured by dragging. Template remapping/recentering is handled in the combined template integration, outside this PR branch.

A later exact-source edit guard probe confirmed same-ID category/model URL/model size/model fit changes invalidate dependent profiles even with unchanged numeric geometry; color/name-only changes retain them and the earlier snapshot remains intact for undo. The above browser screenshots preceded this narrow guard; the guard has exact-source probe, lint/build and CI evidence, not a separate browser replacement run.
