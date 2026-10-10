# Reusable room templates (#66)

Source: GitHub issue #66, read 2026-10-09. Google Docs URL in docs/project.md is unset; Docs was not verified or edited.

## Acceptance

- Save the current visible room as a named template. The library mounts one selected 3D preview at a time. Multiple snapshots are stored per user, connection and API origin in this browser, separate from rooms.
- Open a saved template in the existing layout editor. Rename, move, rotate, recolor, resize, add/delete furniture and save changes. Template changes do not modify the original room or earlier derived rooms.
- Select a template from the library to create a distinct saved room containing its current geometry, windows, wall/floor colors, furniture positions/rotations/sizes, and local model/image references. Offline and API repositories both support reuse.
- API reuse creates an owner-scoped database Room using additive optional RoomInput.template_scene. It is ready immediately without invoking photo analysis or generating new products. The standard create behavior is unchanged when the field is omitted.
- Persistence failures retain templates in the current query session and warn that reload loses unpersisted changes. Foreign owners/scopes do not read those templates. Corrupt saved data reports an error.

## Decisions and boundaries

A template treats the visible furniture as owned furniture rather than purchasing the same suggested items again. Recommendation markers, replacement operations and server product identifiers are cleared. Server input is bounded to 100 objects, 20 windows, IDs of 64 characters, labels of 100 characters, finite bounded dimensions/coordinates, valid colors and unique IDs. Supplied external model/texture URLs are not persisted or fetched; the server resolves models using its trusted catalog. Valid local visual metadata remains in browser overlays. The template library and manual visual edits do not synchronize across devices.

Legacy complete GLB scenes cannot be converted into individually editable templates; the UI explains this limitation. The formal scene-based room API and offline dimensional rooms are supported. Template rooms are not described as AI-generated.

No new tests are committed. Validation uses existing lint/build, room/coordination request specs, RuboCop, generated Swagger/types, temporary authenticated database checks, and rendered browser evidence.

Validation completed before browser QA: frontend lint/build, 13 existing room/coordination request examples, RuboCop for four changed Ruby files, generated Swagger (41 dry-run examples) and TypeScript contract. Temporary authenticated Rack requests in isolated issue_66_verification_test DB passed full scene preservation, distinct IDs, foreign-owner 404, 14 invalid variants rejected, and subsequent coordination validation without duplicated base objects. Temporary source regression checks for #39/#40/#41 and API repository cloning passed. These checks are local; deployed API, cloud storage and provider behavior are not verified.

Rendered browser verification passed on 2026-10-09 using installed Chrome against this checkout, with intercepted local API fixtures: two templates saved, active preview switched with at most one canvas, furniture recolored/moved/resized/rotated, furniture added/deleted/added, wall color and title saved, edits retained after reload, source and unedited template unchanged, two derived room IDs with prior derived room unchanged, foreign-owner template library empty, and a 390px library without horizontal overflow. Four inspected screenshots are in docs/pr-evidence/issue-66. Console contained React development notices only. Browser fixture requests and the separate real local authenticated database checks are distinct evidence; no deployed/provider verification is claimed.

Integration with reviewed character/palette PR #93 preserves both optional identity fields in the template snapshot. The existing catalogue validation in isRoomDesign rejects invalid IDs; template save/read/edit and offline/API clone paths retain valid IDs along with the edited wall/floor colors. Template storage and derived-room visual overlays remain browser-local as documented above. This corrects an integration omission in PR #99 without adding an API field or database change.


Integration verification: frontend lint/build passed. A temporary Node runtime exercised all 488 theme/palette combinations (eight themes, 60 explicit palettes and omitted palette), retaining IDs and edited colors through snapshot, save, edit, storage reload, offline/API reuse and derived-room overlay reload. Original rooms stayed unchanged. Invalid IDs and invalid value types were rejected by snapshot/storage/offline validation. Vite environment values were replaced only in the temporary Node loader; this is source/repository proof, not new browser or deployed API verification. No permanent tests were added.


Initial compatibility correction for floor-color editing (#59): inferred/sample snapshots use an optional top-level floorColor when present, instead of replacing it with the legacy default. A narrow property/type check keeps this correction compatible with the earlier RoomDesign contract; existing snapshot geometry validation rejects invalid hex colors. At that earlier head, measured room.floorColor remained authoritative; the complete integration below now captures the visible override as the copied room baseline. Temporary source/repository checks preserved three custom inferred colors through clone/save/storage reload/offline and API reuse/derived overlay reload, verified the API scene color, rejected invalid colors and types, preserved the legacy default, and left source designs unchanged. Existing frontend lint/build passed; no new tests, Vite session, or deployed/API browser proof were added.


Complete integration verification at `297b2515213a0a6efb1b4a10b2509d4fa25179ed` confirms that both inferred and measured templates capture the current visible floor while leaving the source original unchanged. The shared `copyFurniture` helper remaps support IDs and translates captured affine offsets, contact heights and supporting positions when inferred rooms are recentered; API reuse invokes the same helper. Image references use narrowly validated owned template IDs, preserving the existing category/image validation and avoiding duplicate manual input. Template artwork stays in scoped browser overlays and is omitted from coordination edits, while newly added manual artwork retains the existing API payload. Existing lint/build and temporary exact-source theme, floor, image and 64 surface-profile cases passed. See `docs/pr-evidence/issue-66/integration-retention.md`; no new browser, server, API/database or production verification is claimed.


2026-10-10: この仕様の画面まわりは `specs/screen-refactor/spec.md` で置き換えた。
