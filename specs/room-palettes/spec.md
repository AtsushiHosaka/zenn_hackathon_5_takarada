# Room color palettes — issue #74

Source: https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/74 (requirements provided on 2026-10-09). `docs/project.md` has no Google Docs URL; Docs were not read or updated.

Provide all 60 exact palettes and three hex colors from the issue. Warm Ivory is initially selected. Visible choices contain swatches only; each native radio has an accessible theme name and keyboard focus. Base occupies 50%, secondary 30%, accent 20% of the swatch. App chrome retains its existing colors.

The selected palette accompanies first generation and followup requests and restores with saved rooms. API coordination input/output adds optional `room_palette_id`; old clients omit it and retain previous behavior. Persist the option in coordination analysis JSONB to survive async generation without a DB migration. Reject ids outside the catalogue. Successful generation retains the metadata.

Apply base to walls and secondary to flooring. Add all three colors to both furniture operation search and decoration/planner input, with the chosen palette taking priority over conflicting color words in the freeform prompt. Do not recolor existing furniture or real EC products, and do not represent these palettes as official character colors. Before preserves the analyzed room; After uses the palette.

Backend config JSON and frontend domain JSON are identical catalogue copies so independent Docker build contexts can load them. Keep both synchronized. The offline dummy applies wall/floor colors to its dimensional room without claiming product/provider generation. Initial API analysis carries selection to the later coordination form without repainting the original analyzed scene.

Validation completed locally on 2026-10-09:

- Frontend `npm run lint` and `npm run build` passed; Vite reports the existing large-chunk warning.
- Existing coordination request specs: 6 examples, 0 failures. Backend RuboCop passed.
- Swagger regenerated with Rails rswag in existing API container using copied source `/tmp/issue74-backend` and isolated `DB_NAME=issue74_checks`; generated frontend types refreshed.
- A temporary runtime script used authenticated Rails request dispatch for all 60 POST/job/GET sequences. Confirmed exact wall/floor colors, persisted palette selection, accent in generation prompt, unchanged Before/original room, and 422 for an unknown palette. This uses actual controllers and persistence with mock providers; it is not network-hosted or live Gemini/EC proof.
- A temporary SSR bundle of the dummy repository confirmed all 60 colors, restored selection after repository recreation, Warm Ivory default, and rejection of an invalid id. Catalogue copies exactly match the 60 source rows.

Browser selection/keyboard/3D screenshots are pending root-agent review. Live Gemini/EC and deployed environments remain unverified. No new test files are added. The optional API field is implemented; existing iOS clients may omit it and retain previous behavior. No iOS UI change is included.
