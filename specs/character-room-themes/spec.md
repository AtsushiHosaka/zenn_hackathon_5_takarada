# Character room themes

Source: [GitHub issue #73](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/73), read 2026-10-09. The user explicitly selected Hello Kitty, My Melody, Kuromi, Cinnamoroll and Pompompurin for individual Sanrio themes. Hatsune Miku and a common Sanrio theme come from the issue. The Google Docs URL in `docs/project.md` is unset; Docs were not read or changed.

## Accepted scope and choices

A visible theme chooser supports seven IDs: `hatsune-miku`, `sanrio`, `hello-kitty`, `my-melody`, `kuromi`, `cinnamoroll` and `pompompurin`. Users can also choose no character theme. Each theme includes separate room-generation directions, result title, default colors and a deterministic abstract 3D wall motif. The motifs are music notes, stars/heart, bow, hearts, sharp stars, cloud and pudding, respectively. These are theme-inspired accents rather than official character images or merchandise. Poster/acrylic image import remains issue #72.

The chooser appears on the final creation step, before coordinating an analyzed room, and with follow-up requests for existing coordinated rooms. API analysis carries the choice locally to the later coordination step. Dummy creation renders the selected theme directly. Existing editing and saved-room behavior remain available.

## Persistence and generation

`GenerateRoomInput.characterThemeId` and `RoomDesign.characterThemeId` carry the choice. Authenticated coordination input/output adds optional `character_theme_id`. The backend validates the seven IDs and persists the value in existing coordination analysis JSON, including after generation overwrites its diagnostics. No new DB column, endpoint or environment variable is required. Web types and Swagger are regenerated. Existing iOS clients may ignore the optional field; native iOS theme chooser/motif rendering is outside this Web issue.

The backend augments the planner/search prompt with the selected theme's name and design directions while keeping the original saved prompt unchanged. It preserves actual product colors, names, prices and links; it does not fabricate official products. A theme-specific result title and comment identify the selected theme even in mock mode. Default room walls/floor use the theme colors when no separate room palette is supplied. Product selection in mock mode continues to use the existing fixture catalog; theme motifs are procedural accents, not purchased items or additions to the shopping total.

Frontend and backend theme catalogues contain identical definitions because each deployment ships its own source tree. Temporary validation compared all entries. Future catalogue edits must update both files.

## Compatibility with issue #74

Character identity and the room palette are separate choices. `CharacterRoomTheme.prompt` is composed first and `RoomPalette.prompt` second in `Coordination#generation_prompt`, so explicit palette instructions have precedence. The builder's theme defaults only run if no `room_palette_id` exists; the selected palette determines wall/floor colors. Theme motifs retain their identity and silhouette under the shared palette. `applyCharacterTheme` similarly preserves a supplied `roomPaletteId`. Integration keeps the character result title when both choices are supplied and composes both transformations in dummy generation. Explicit palette accent/secondary colors also tint the character motif geometry; each character retains its distinct silhouette. Theme-only callers that omit a palette keep theme defaults. The Web chooser initializes Warm Ivory and passes it explicitly.

## Verification

Frontend lint and production build passed. The build retains the existing large-chunk warning. Full backend RuboCop passed. Swagger was generated via Rails rswag in temporary `/tmp/issue73-backend` source on the existing container with isolated `issue73_checks_test` DB; web types were generated from that contract. Existing room/coordination request specs passed, 13 examples and 0 failures. The existing successful creation contract exercises the theme ID in request/response.

A temporary rolled-back transaction checked all seven themes via authenticated controller POST, mock generation job, and GET retrieval. It checked theme metadata/title, room colors, augmented prompt instructions, original Before colors, and rejection of unknown IDs. A temporary frontend SSR script checked all seven dummy themes through save/reload, equal frontend/backend catalogues, seven distinct motif geometries and unknown-ID rejection.

Browser selection/rendering, screenshots, live Gemini, production and native iOS are not yet verified. The root agent owns the shared browser review and PR publication. No new permanent tests were added.

## Combined integration verification

Stacked implementation is based on `codex/issue-74-room-palettes`, including palette UI evidence at commit `08be362`. Frontend lint/build and full backend RuboCop passed after resolving the overlaps. Existing room/coordination specs passed, 13 examples and 0 failures. Combined Swagger and web types were regenerated.

A temporary rolled-back authenticated Rails POST/job/GET transaction checked all seven themes both with and without explicit palettes. It verified both persisted IDs, character title, palette wall/floor precedence, character-before-palette prompt ordering, unchanged original room/Before, followup base references and invalid-id rejection. A temporary SSR runtime check passed all 420 character/palette combinations and restored saved rooms. It verified motif colors come from the selected palette while all seven motif geometries remain distinct. No permanent tests or new running apps were created.

Browser screenshots and live provider/deployment verification remain with the root agent. The authenticated temporary checks use Rails request dispatch and mock providers, not a network-hosted API or live Gemini/EC.

The final branch also merges prepared palette branch `170d93d1c4def534d5f414a09084a46043ec2035`, preserving the published upload, generation-step and followup-mode ancestry. Frontend lint/build and the 420-combination dummy checks passed again after this merge. A temporary harness executed the actual extracted `RoomStudioPage` mutation function for current/new requests and confirmed both theme/palette IDs, existing-room/base references, new-room photo/furniture isolation and aborted-request progress guards. No browser was launched by this agent.
