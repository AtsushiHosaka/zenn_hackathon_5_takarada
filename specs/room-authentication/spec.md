# Require authentication before showing rooms

## Source and scope

On 2026-10-08, the user reported that the deployed Web app allowed browsing My Room and room chat history while the New Room button redirected to login. The user requested that room pages become accessible only after login or signup.

The reported deployment is https://zenn-hackathon-web-55ceumihtq-an.a.run.app/login. `docs/project.md` has no Google Docs URL, so the direct request and existing local specifications are the provisional sources. This change remains unreflected in Google Docs and supersedes the guest sample-room exception in `specs/room-ownership/spec.md`.

## Acceptance criteria

- `/rooms` and every `/rooms/:id` require an authenticated session, including samples, new rooms, saved rooms, and the development dummy connection.
- Guests see login before any room page mounts. Login and signup preserve the requested path, query, and fragment and return there after successful authentication.
- `/` opens My Room at `/rooms`; `/coordinate` continues to open the protected `/rooms/new` route.
- Logout or a rejected session prevents continued room access. Existing loading and retry states remain available while checking a session.

## Implementation

Use the existing `RequireAuth` wrapper on both room routes and remove sample/dummy bypasses. Keep the user-scoped room component key inside the guard. Existing backend room endpoints already require authentication and ownership; API contracts do not change.

## Verification

On 2026-10-08, frontend lint and the production build passed. The build reports the existing large-chunk warning.

Browser checks on the local dummy connection confirmed that `/`, `/rooms`, new rooms, all four samples, a saved-room URL, and `/coordinate` redirect guests to login. Switching login to signup and back preserved the requested destination; successful dummy login returned to the sample with its query and fragment intact. My Room and New Room then opened directly. Logout and browser Back both kept room content behind login.

The frontend-only runtime image was released to the reported Cloud Run service as revision `zenn-hackathon-web-00026-qhr`, serving 100% of traffic. In a guest browser on the exact reported origin, the same nine room entry points all redirected to `/login`. Backend services and database tasks were not deployed or run.

Signup submission, session expiry/network-error states, and real API authentication were not exercised. Their existing session implementation is unchanged. No new automated tests are added under the repository policy.
