# List the authenticated user's rooms

## Source and cause

On 2026-10-08, the user reported a Not Found response when opening rooms and confirmed that the failing request was `GET /api/v1/rooms`.

Before this fix, the backend declared rooms with only `create` and `show` routes. The collection GET route was missing, so the request could not reach a room-list action.

`docs/project.md` has no Google Docs URL. The direct request, existing routes, and existing Room API schema are the provisional sources. This change remains unreflected in Google Docs.

## Acceptance criteria

- `GET /api/v1/rooms` requires authentication.
- A successful response is HTTP 200 with a bare JSON array. Each item uses the existing Room response schema.
- The response includes only rooms owned by the authenticated user. Rooms owned by other users and anonymous rooms are excluded.
- Rooms are ordered by ID descending, with the newest IDs first.
- A user with no rooms receives `[]`.
- Existing room creation and individual room retrieval retain their current behavior.

## Implementation scope

Add the collection GET route and an owner-scoped index action. Update the existing API contract definitions and regenerate the shared OpenAPI and frontend API types. No frontend page or hosting configuration change is required by this request.

## Verification

On 2026-10-08, all seven room request examples passed, including the minimal new OpenAPI contract definitions for HTTP 200 and 401. The successful list contract check also verified descending IDs and exclusion of other users' and anonymous rooms. Existing creation and detail examples passed.

A temporary Rails integration request in the test environment confirmed HTTP 200 with `[]` for an authenticated user without rooms; its temporary user was rolled back. Ruby lint passed for the three edited Ruby files. OpenAPI was regenerated with `bundle exec rails rswag` (the command used by `make docs`), and frontend types were regenerated with `npm run types`. Frontend type checking passed for both TypeScript projects, with build-info output redirected to `/private/tmp` because the normal command could not write through the reused dependency-directory symlink. The Japanese contract-text lint only flagged an unchanged existing description.

Verification reused the existing API container with a temporary copy of this checkout. No new app or container was started, and the other mounted working tree was not edited. No production deployment or live endpoint verification was performed.
