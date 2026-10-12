# Character room themes — issue #73

Source: [issue #73](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/73), read 2026-10-09. The user selected Hello Kitty, My Melody, Kuromi, Cinnamoroll and Pompompurin. The issue was subsequently edited in parallel to list Pochacco instead of My Melody. The implementation preserves all five user choices and adds Pochacco, following the union assumption stated while clarification was pending. Hatsune Miku and shared Sanrio are also required by the issue. The Google Docs URL in docs/project.md is unset; Docs were not read or changed.

## Behavior

The chooser supports eight themes and an unspecified option. Each theme has separate generation instructions, a saved identity/title, default colors and an abstract 3D motif: music notes, stars/heart, bow, hearts, sharp stars, cloud, pudding and paw. These are theme-inspired accents, not official images or merchandise. Image posters and stands are handled in #72.

The chooser appears on the final creation step, before coordinating an analyzed room, and with later requests for coordinated rooms. API analysis carries the choice locally to coordination. Dummy creation renders colors/motifs directly and states that it does not analyze photos/free text or generate product recommendations.

## Contract and composition

Optional GenerateRoomInput.characterThemeId and coordination character_theme_id carry the selected theme. The backend validates the catalogue and persists its ID in existing analysis JSON, including after generation diagnostics are written. Swagger and web types are regenerated. No migration, endpoint or environment variable is added. Native iOS picker/rendering is outside this Web change.

CharacterRoomTheme.prompt adds instructions and default hex colors; RoomPalette.prompt follows it, so explicit palette colors take precedence. Both coordination and furniture-operation planners receive generation_prompt. Original saved prompt and actual product names, colors, prices and links remain unchanged.

Theme-only callers retain theme wall/floor colors. Explicit room palettes determine wall/floor colors and procedural accent colors; the Web chooser initializes Warm Ivory. Character result titles and motif silhouettes remain distinct. Frontend/backend catalogue copies must be changed together.

The renderer suppresses generic purple oshi primitives for character themes. Snapshot Before scenes clear current theme/palette metadata and retain the original room/item colors. Legacy Before toggles hide motifs before the first frame and on subsequent toggles. Motifs are procedural room accents, not purchased products or shopping-total additions.

This PR is stacked on #87 and includes the preceding upload, progress and current/new-room fixes. Both theme/palette choices survive current/new requests; new rooms exclude old room/base/photo/furniture references, and aborted progress updates are ignored.

## Verification and limits

Frontend lint/build, backend RuboCop, existing coordination request examples (6), Swagger generation and web type generation passed on the final correction. The production build retains its existing large-chunk warning. No permanent tests were added.

Temporary authenticated Rails POST → mock job → GET checks covered all eight themes with/without explicit palettes, persistence, titles, default colors, character-before-palette prompt order, invalid-ID rejection and unchanged original/Before data. All 480 theme × palette dummy combinations passed generation, save and restore. Actual geometry/visibility checks confirmed distinct motifs, palette-first accents, no generic purple primitives, initial/toggled legacy Before visibility and snapshot immutability. Actual mutation-function checks covered current/new isolation and cancellation guards.

Browser verification generated/reloaded all eight themes with Teal Studio, checked identity/title/palette persistence and a 390px chooser without horizontal overflow. The Miku Before view hid its music motif and After restored it. Screenshots in docs/pr-evidence/issue-73 show the chooser, Miku room and Kuromi room from the final source. The existing browser/server was reused with an isolated context.

These checks use deterministic dummy rendering and mock API providers. Live Gemini, live EC search, production and native iOS remain unverified. No deployment was performed.


2026-10-10: この仕様の画面まわりは `specs/screen-refactor/spec.md` で置き換えた。
