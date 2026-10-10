# Room color palettes — issue #74

Source: https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/74 (requirements provided on 2026-10-09). `docs/project.md` has no Google Docs URL; Docs were not read or updated.

Retain all 60 exact palettes and three hex colors internally. On 2026-10-09 the user superseded the issue's all-palettes UI requirement: ask for the desired room atmosphere in a sentence first, then offer a few matching themes. The new-room wizard starts with atmosphere for coordination and offline previews. Blank text shows no swatches; nonblank text shows four suggestions. Japanese and English color/style keywords rank the catalogue locally, with stable, varied defaults for unrecognized prose. This is keyword matching, not provider-generated interpretation; nuanced prose and complex negation remain limited. A selected suggestion takes priority among the current four; changing the description replaces unsuitable choices and selects the first matching suggestion. Requests without recognized atmosphere/color terms retain the existing valid palette, so a budget-only followup preserves its colors.

Initial coordination, analyzed-room coordination and followup forms all use the same shortlist and selected-id resolution for display and generation. Each native radio has an accessible theme name and keyboard focus. Base occupies 50%, secondary 30%, accent 20% of the swatch. App chrome retains its existing colors. Google Docs could not be updated because the project URL remains unset.

Sentence-first validation: frontend lint/build passed, Japanese UI copy lint passed, and independent source review checked wizard/selection/request consistency. A temporary Chrome component preview confirmed zero radios before input, four after input, refreshed matching candidates, mouse/keyboard selection, and budget-only color preservation. Evidence is in `docs/pr-evidence/atmosphere-search/README.md`. The full local application requires login; authenticated generation and deployment were not verified for this change. No new test files or dependencies were added.

The selected palette accompanies first generation and followup requests and restores with saved rooms. API coordination input/output adds optional `room_palette_id`; old clients omit it and retain previous behavior. Persist the option in coordination analysis JSONB to survive async generation without a DB migration. Reject ids outside the catalogue. Successful generation retains the metadata.

Apply base to walls and secondary to flooring. Add all three colors to both furniture operation search and decoration/planner input, with the chosen palette taking priority over conflicting color words in the freeform prompt. Do not recolor existing furniture or real EC products, and do not represent these palettes as official character colors. Before preserves the analyzed room; After uses the palette.

Backend config JSON and frontend domain JSON are identical catalogue copies so independent Docker build contexts can load them. Keep both synchronized. The offline dummy applies wall/floor colors to its dimensional room without claiming product/provider generation. Initial API analysis carries selection to the later coordination form without repainting the original analyzed scene.

Validation of the original 60-palette implementation completed locally on 2026-10-09 (historical; the all-60 UI below was superseded by the sentence-first change):

- Frontend `npm run lint` and `npm run build` passed; Vite reports the existing large-chunk warning.
- Existing coordination request specs: 6 examples, 0 failures. Backend RuboCop passed.
- Swagger regenerated with Rails rswag in existing API container using copied source `/tmp/issue74-backend` and isolated `DB_NAME=issue74_checks`; generated frontend types refreshed.
- A temporary runtime script used authenticated Rails request dispatch for all 60 POST/job/GET sequences. Confirmed exact wall/floor colors, persisted palette selection, accent in generation prompt, unchanged Before/original room, and 422 for an unknown palette. This uses actual controllers and persistence with mock providers; it is not network-hosted or live Gemini/EC proof.
- A temporary SSR bundle of the dummy repository confirmed all 60 colors, restored selection after repository recreation, Warm Ivory default, and rejection of an invalid id. Catalogue copies exactly match the 60 source rows.

Root browser verification confirmed all 60 accessible swatches, Warm Ivory initially checked, Teal Studio selection, generated wall/floor colors, and restoration after reload. A 390px viewport had no horizontal overflow. Screenshot is in docs/pr-evidence/issue-74/sixty-palettes.png. Live Gemini/EC and deployed environments remain unverified. No new test files are added. The optional API field is implemented; existing iOS clients may omit it and retain previous behavior. No iOS UI change is included.


2026-10-10: この仕様の画面まわりは `specs/screen-refactor/spec.md` で置き換えた。
