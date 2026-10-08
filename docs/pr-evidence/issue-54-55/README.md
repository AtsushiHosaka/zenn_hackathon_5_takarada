# Panel and planner evidence

Verified 2026-10-09 using the shared Playwright CLI browser against Vite on port 5174 and the integration base pinned in `specs/ui-motion/integration-base.md`. The temporary browser journey `/tmp/issue54-55-browser.js` returned PASS. No new tests are committed.

## Captures

- `products.png`: 1440×1000 actual sample room, product list, reference pins and positioned tooltip after product filtering and scroll restoration.
- `planner.png`: 1440×1000 actual procedural room with top view, grid, dimensions, edited table, swatches and successful local save notice.
- `mobile-planner-reduced.png`: 390×844 viewport editor after live reduced-motion preference change, with visible native controls and footer.

All three captures were visually inspected; actual 3D scenes rendered without a loading or model fallback. The mobile screenshot verifies the full-width editor overlay. The pre-existing mobile Products/3D split at this pinned base is handled and verified by the combined #58 integration.

## Verified behavior

The sample room journey checked a single retained canvas, panel entrance/exit and rapid reopen, immediate inertness during exit, heading/opener focus, per-mode scroll restoration, stable surviving product DOM rows, capped stagger, no replay on pointer selection, keyboard selection and an immediately opened native external link. The destination was intercepted with local HTML, so shop availability is not proved.

The API-room journey used locally intercepted owner/room/catalog responses, three legacy category-only request rows and a centered manual table. Removing the first row preserved the next native select identity; category edits and appending retained the intended row values. Dimensions and tooltip positioning transforms remained intact. Move/undo/redo, swatches, views and Before/After updated immediately. Actual mouse dragging ray-picked the table, respected 10cm snapping and stayed inside room bounds.

Local save success cleared dirty state. Simulating storage quota failure showed the error and retained dirty state; restoring storage allowed a successful save. The native CSV download completed. Live reduced motion removed held exits and control transitions; the mobile editor stayed within the 390×844 viewport without horizontal document overflow. No page errors or excessive WebGL-context warnings occurred.

Browser verification exposed two application regressions that were corrected before the final PASS: detached outgoing list nodes overwrote cached scroll with zero, and unchanged pointer selection could undo restored scroll. Scroll is now captured while the connected list is active and unchanged pointer selection does not auto-scroll. Reference pins were also restored for truthful unchanged demo geometry while the older purple narrative remains separately guarded.

## Boundaries

API responses and external-link destinations were intercepted local fixtures. These checks do not prove a deployed environment, provider generation, real cloud DB/authentication, physical touch hardware, or the final combined motion inventory. Browser and Vite were closed after verification and the shared slot was explicitly released to the parent agent.
