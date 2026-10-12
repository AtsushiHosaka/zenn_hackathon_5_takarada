# Issue #62: home Not Found investigation

Source: https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/62. Google Docs URL is unset. Investigation performed 2026-10-09 JST against current origin/main.

## Identify the failing surface

The historical report is identified in specs/room-list-api/spec.md: the user confirmed GET /api/v1/rooms, rather than browser /rooms, failed. The backend originally had only create/show routes. Commit 4fd1e18 added the authenticated collection route and owner-scoped index, and is already on main. Current config/routes.rb exposes GET /api/v1/rooms; RoomsController#index scopes to current_user.rooms and serializes the collection. React also defines /rooms and nginx falls back to index.html for SPA paths.

## Current reproducible checks

Public read-only requests on 2026-10-09 JST:

| Request | Status | Observed response |
| --- | --- | --- |
| GET https://zenn-hackathon-web-55ceumihtq-an.a.run.app/rooms | 200 | Japanese SPA HTML |
| GET https://zenn-hackathon-api-262220651661.asia-northeast1.run.app/api/v1/rooms without credentials | 401 | JSON error: You need to sign in or sign up before continuing. |

The prior collection-route 404 is not reproduced by these requests. A 200 HTML shell does not prove that an authenticated browser loads its data; a 401 proves this public request reaches authentication, not that authenticated collection reads succeed. Do not equate the current responses with a verified authenticated room library.

## Cause and response

The recorded original cause was a missing API collection route, already corrected on main. No additional duplicate route or page change is warranted by current evidence. If a signed-in user still sees Not Found, capture the failed request URL, HTTP status/body, timestamp, and deployed revision; then distinguish stale deployment, incorrect API origin, missing individual room, and current authentication. A new authenticated reproduction is required to attribute a remaining failure. No login, data mutation, or deployment was performed in this investigation.
