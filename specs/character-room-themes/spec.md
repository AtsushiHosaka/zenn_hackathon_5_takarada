# Character room themes — issue #73

Source: [issue #73](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/73), read 2026-10-09. The user selected Hello Kitty, My Melody, Kuromi, Cinnamoroll and Pompompurin. The issue was subsequently edited in parallel to list Pochacco instead of My Melody. The implementation preserves all five user choices and adds Pochacco, following the union assumption stated while clarification was pending. Hatsune Miku and shared Sanrio are also required by the issue. The Google Docs URL in docs/project.md is unset; Docs were not read or changed.

## Behavior

The chooser supports eight themes and an unspecified option. Each theme has separate generation instructions, a saved identity/title, default colors and an abstract 3D motif: music notes, stars/heart, bow, hearts, sharp stars, cloud, pudding and paw. These are theme-inspired accents, not official images or merchandise. Image posters and stands are handled in #72.

The chooser appears on the final creation step, before coordinating an analyzed room, and with later requests for coordinated rooms. API analysis carries the choice locally to coordination. Dummy creation renders colors/motifs directly and states that it does not analyze photos/free text or generate product recommendations.

## Contract and composition

Optional GenerateRoomInput.characterThemeId and coordination character_theme_id carry the selected theme. The backend validates the catalogue and persists its ID in existing analysis JSON, including after generation diagnostics are written. Swagger and web types are regenerated. No migration, endpoint or environment variable is added. Native iOS picker/rendering is outside this Web change.

CharacterRoomTheme.prompt adds instructions and default hex colors; RoomPalette.prompt follows it, so explicit palette colors take precedence. Both coordination and furniture-operation planners receive generation_prompt. Original saved prompt and actual product names, colors, prices and links remain unchanged.

Theme-only callers retain theme wall/floor colors. Explicit room palettes determine wall/floor colors and procedural accent colors. The Web chooser's original Warm Ivory initialization is superseded by the theme-aware suggestions below. Character result titles and motif silhouettes remain distinct. Frontend/backend catalogue copies must be changed together.

The renderer suppresses generic purple oshi primitives for character themes. Snapshot Before scenes clear current theme/palette metadata and retain the original room/item colors. Legacy Before toggles hide motifs before the first frame and on subsequent toggles. Motifs are procedural room accents, not purchased products or shopping-total additions.

This PR is stacked on #87 and includes the preceding upload, progress and current/new-room fixes. Both theme/palette choices survive current/new requests; new rooms exclude old room/base/photo/furniture references, and aborted progress updates are ignored.

## Verification and limits

Frontend lint/build, backend RuboCop, existing coordination request examples (6), Swagger generation and web type generation passed on the final correction. The production build retains its existing large-chunk warning. No permanent tests were added.

Temporary authenticated Rails POST → mock job → GET checks covered all eight themes with/without explicit palettes, persistence, titles, default colors, character-before-palette prompt order, invalid-ID rejection and unchanged original/Before data. All 480 theme × palette dummy combinations passed generation, save and restore. Actual geometry/visibility checks confirmed distinct motifs, palette-first accents, no generic purple primitives, initial/toggled legacy Before visibility and snapshot immutability. Actual mutation-function checks covered current/new isolation and cancellation guards.

Browser verification generated/reloaded all eight themes with Teal Studio, checked identity/title/palette persistence and a 390px chooser without horizontal overflow. The Miku Before view hid its music motif and After restored it. Screenshots in docs/pr-evidence/issue-73 show the chooser, Miku room and Kuromi room from the final source. The existing browser/server was reused with an isolated context.

These checks use deterministic dummy rendering and mock API providers. Live Gemini, live EC search, production and native iOS remain unverified. No deployment was performed.


2026-10-10: この仕様の画面まわりは `specs/screen-refactor/spec.md` で置き換えた。

## Theme tags update, 2026-10-12

Source: the user's request and screenshot in this chat. Remove the separate character-theme section and offer character names as theme tag chips. This explicit request supersedes the Miku-only selection restriction in `specs/screen-refactor/spec.md`. The Google Docs URL remains unset, so this change is recorded locally and has not been reflected in Docs.

The theme tag group combines the existing atmosphere preset chips with all eight themes already supported by the shared frontend/backend catalogue and API enum. The same character chips appear in the refinement composer. Character selection remains optional and limited to one character theme; selecting an active chip clears it, and selecting another replaces it. Presets retain their existing brief/style behavior and compose with the selected character.

Character chips are available before a brief is entered. When the brief is empty, selecting a character fills a short request naming that character. Switching or clearing a character replaces or clears only an unchanged auto-filled request; typed or edited text is preserved. Selection still passes the existing `characterThemeId` to generation, retains saved identities, and leaves the API contract and motif rendering unchanged. No unsupported IDs or permanent tests are added.

Frontend lint/build passed for this update. In-app browser checks covered all eight visible character chips, initial selection, switching, deselection, preservation of typed briefs, and a Miku dummy room retaining its identity after reload. The default 547px viewport wrapped the tags without horizontal page overflow. Isolated fixtures using the actual room page verified the analyzed-room request and refinement composer; captured GenerateRoomInput contained the selected Miku/Kuromi identity and the preserved brief. Those requests stayed local and do not prove a live provider/API outcome. Screenshots and snapshots are in `outputs/room-fixes/20261012`. The earlier verification above covers the original implementation only. Production, real AI generation, and native iOS were not exercised or changed.

## Miku recommendation quality update, 2026-10-12

Source: the user's request in this chat to consider ordinary cyan/blue furniture when choosing Hatsune Miku. Google Docs remain unset; this change is not reflected in Docs.

Treat Miku as an interior direction: ordinary cyan, turquoise and blue furniture/textiles, complementary white/gray/black functional furniture, and Miku goods as accents around display/work areas. The generation prompt considers usability, retained furniture, music/work/display space and circulation. Do not maximize character merchandise or fabricate product colors/availability.

New/analyzed rooms derive a palette from the brief and theme. A name-only Miku brief defaults to the existing Blue swatch (`sky-white`), with Mint, White and Black alternatives. Explicit color text overrides automatic theme colors; an explicitly chosen swatch overrides subsequent automatic suggestions. Clicking the already suggested swatch also records an explicit selection. A theme switch drops an inherited palette, while saved palettes remain valid choices. Existing palettes and API enums remain unchanged.

Miku candidate ranking uses published product names/color names, without treating preview RGB as color evidence. A valid room palette takes precedence over brief colors, matching generation instructions; without a palette, literal color terms take precedence over Miku defaults. LLM-inferred colors do not override a name-only Miku request. Character identity is supplied to the planner. Ordinary furniture remains eligible; unrelated character goods are excluded from automatic candidates, and explicit user choices remain eligible.

The finite AI shortlist reserves roughly three quarters for ordinary furniture when both ordinary furniture and Miku goods are available; remaining capacity contains Miku goods. This is a candidate policy, not a forced purchase quota. Shape variety applies within equal relevance scores so it cannot displace all palette matches. User choices and eligible previous picks remain available. Changing Miku theme/palette clears automatic previous-pick priority; owned furniture and explicit selections retain their existing protection. Same-theme refinements retain prior context. Mock suggestions use ordinary furniture for large surfaces and goods for accent slots. Gemini still chooses the accepted bundle; rejected groups are never auto-filled.

If none of the placed products matches the requested palette, the result states that limitation. No SKU colors, prices, URLs, stock records or production catalog rows are modified. The local seed catalog has 92 purchasable details, no cyan-named products, two blue-named floor chairs and no purchasable Miku details. Those counts do not establish production inventory or current shop availability. The algorithm can use new eligible catalog entries, but catalog coverage remains a separate quality constraint.

Verification uses existing request specs, frontend lint/build, targeted Ruby lint, an isolated Rails builder probe with seeded and dense synthetic catalogs, and the actual room page with intercepted local generation requests. See `outputs/miku-suggestions/20261012/verification.md`. Real Gemini quality, external shop availability, production deployment and native iOS remain unverified.
