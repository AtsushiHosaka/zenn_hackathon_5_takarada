# Shop-backed theme color variants

Source: user requests in this chat, 2026-10-12. Only colors actually sold by the shop qualify; automatic preview recoloring is excluded. Google Docs URL remains unset in `docs/project.md`; these requirements are not reflected in Docs.

Theme selection considers published sale colors before furniture shortlisting. Miku defaults to blue/cyan, green/mint and white. Explicit alternative color preferences retain precedence. Other character tags use their theme colors and white. Owned furniture that the user keeps remains unchanged. Automatic new products require a source-backed check within 30 days; unavailable, unknown, stale and unsupported products cannot silently fill a theme slot. Multicolor articles containing conflicting colors are excluded. No matching product means an explicit shortage, not a simulated SKU color.

Retail families require the shop's explicit color picker or structured ProductGroup membership including the current article. A shared 3D model or similar product name cannot establish a family. Each color retains its own article ID, official color, price, URL, image, checked timestamp and availability. Only same-shop, same-model/category and same-size articles can replace the color of a chosen product. Before and saved merchandise records remain independent. Commercial edits invalidate stale verification.

Generation and furniture search continue using DB records. The separate shop refresh visits registered public product pages, with a fixed host/path allowlist, robots checks, public-IP pinning, redirect checks, request timeouts and size caps. It writes an additive candidate catalog and an audit. Unsupported shops, fetch failures, ambiguous groups and size changes are reported. Listed for sale does not establish destination-specific delivery stock.

Refresh from the backend directory with the API's Ruby dependencies:

```sh
bundle exec ruby script/refresh_shop_color_variants.rb --input db/furniture_details.json --output /tmp/verified-furniture-colors.json --audit /tmp/furniture-color-audit.json
```

For an existing DB, export its current catalog first; do not use the initial seed to overwrite administrator edits. Review the output, then run inside the backend runtime:

```sh
FILE=/path/to/verified-furniture-colors.json bundle exec rake furniture_detail:import_verified_colors
```

The additive import preserves unrelated/disabled products and performs no reset or deletion. Apply the Schemafile before using the new metadata columns. New installations receive verified variants through the initial catalog; existing installations need the additive import. Live refresh is separate from generation and must be rerun when checks expire. Unsupported providers remain an explicit coverage limit.

The Web color chooser shows published sale colors, the source/check date and availability context. Miku suggestions are blue, mint, white and green. No new API fields are needed; existing product metadata fields carry the evidence. API grouping descriptions are updated through request specs, Swagger generation and frontend type generation.

Verification results and live coverage are recorded in `docs/pr-evidence/shop-color-variants/verification.md`. Native iOS, production deployment, destination-specific stock and checkout are outside this local verification.

## Release integration, 2026-10-12

The user explicitly authorized deployment. Integrated current main `48b5f66`, retaining the new textile placement and light-blue preference logic. Color preference now ranks verified variants before a retail family is reduced to one candidate, so a darker sibling cannot hide its lighter sale color. The eight catalog entries added by that release were checked against shop pages; all seven IKEA originals qualified, while the Francfranc rug remained unverified. All original source rows are preserved; one overlapping SANELA source entry is an explicit alias of its checked article, so the initial import does not duplicate the database SKU.

Both release paths run the additive verified-color import after schema application and before API replacement. Imports skip expired checks and preserve a newer/equal existing shop timestamp. URL matching keeps an existing database product ID even if its source key differs. Production schema reconciliation must be proven additive before release; do not reset the production catalog.

## Light-blue curtains, 2026-10-13

Source: user request in this chat ("カーテン 水色を追加したい"、IKEA と Francfranc の両方を足す). Not reflected in Docs.

IKEA Japan sells no light-blue curtain; its closest article is RITVA grey-blue (ikea:90633767, white sibling ikea:70633768). Both use the existing `curtain_tieback` model. Francfranc's frilled valance curtain 178x100 cm is sold in light blue (francfranc:1102070080988) and light pink (francfranc:1102070080957); both use the new `curtain_valance` model. Depth is the only estimated axis of these two models.

Francfranc article pages publish no colour in JSON-LD. The parser now reads the article's official colour from the size selector entry of that article (`data-color`), accepted only when the article's own title repeats it. Sold colours come from the colour selector's article list (`data-variant-handles`), and dimensions from the spec table's size row. Other Francfranc rows were not rescanned.

"グレーブルー" contains a gray colour word, so the existing conflicting-colour rule keeps RITVA grey-blue out of the default Miku theme shortlist. It stays available through furniture search. The Francfranc light-blue curtain ranks first among Miku curtain candidates.

The `curtain_valance` GLB still has to be placed in the public bucket and registered in existing databases (`make infra-models-publish K=curtain_valance`), and existing databases need the additive verified-colour import for the four new products.
