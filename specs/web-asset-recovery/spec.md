# Recover from missing frontend bundles

## Source and evidence

On 2026-10-12, the user reported a 404 for `/assets/RoomViewer-DP_OucS5.js` from `index-GaP0qn-N.js`, with the room viewer displaying only its degraded message.

Public HTTP checks on the same date confirmed both reported bundles return 404. The deployed HTML instead references `index-CjsNOlOx.js`, which imports `RoomViewer-B8yKVWFm.js`; that viewer returns 200 with JavaScript content. HTML has no Cache-Control header. This confirms a client/server bundle version mismatch; whether the old page was cached or remained open across deployment is unknown.

The Google Docs URL in `docs/project.md` is blank. The user report, current HTTP responses, and existing `specs/web-navigation-recovery/spec.md` are the working baseline. Google Docs was not checked or updated.

## Acceptance and implementation

- HTML and SPA navigation responses use `Cache-Control: no-store` so new navigations load current bundle references.
- Successful hashed assets retain their one-year immutable cache policy. Missing assets remain 404, with `no-store`; they must not return the SPA document.
- A `vite:preloadError` displays a visible reload action even when a nested 3D error boundary handles the failed import. It covers room scenes, saved-room previews, and snapshots through the existing application boundary.
- Keep the current screen mounted when showing the notice. Reload occurs only after the user clicks, preserving the existing recovery policy and warning about unsaved changes. No automatic reload loop.
- Other render failures retain the existing full-page recovery screen. Import rejection is not suppressed, so nested error boundaries can still handle it.

Vite documents deployment-time missing imports and HTML caching in [Building for Production](https://vite.dev/guide/build.html#load-error-handling).

## Validation

On 2026-10-12, `npm run lint` and `npm run build` passed. The build retains its existing large-chunk warning.

The built app was served with the repository nginx template in nginx 1.27.5. `nginx -t` passed. HTTP GET checks confirmed `/`, `/index.html`, and `/rooms/example` return 200 with `no-store`; current index/RoomViewer assets return JavaScript with one-year immutable caching; a nonexistent RoomViewer asset returns 404 with `no-store` and no Expires header.

Playwright intercepted the production-build RoomViewer request with a 404 on `/rooms/sample-natural`. The nested viewer boundary degraded, the recovery notice appeared and received focus, and the room scene remained mounted. Removing the interception and clicking reload kept the same URL, removed the notice, and restored a canvas with viewer readiness `ready`.

Two synthetic preload-error events on a recovered screen preserved the unsaved message value and the same textarea/canvas DOM nodes, produced one notice, and did not reload. At a 375 by 812 viewport, the notice and reload button fit on screen. Screenshots are in `output/playwright/asset-recovery-{404,restored,mobile}.png`.

API responses were mocked and all API requests intercepted in this local browser check. It does not establish authenticated production behavior. No new test suite, API contract, or production deployment is included. Existing tabs running code from before this fix need a manual refresh because they do not contain the new recovery listener.
