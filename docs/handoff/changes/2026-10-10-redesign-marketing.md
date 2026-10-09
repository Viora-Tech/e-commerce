# Admin redesign: Marketing (Discounts, Analytics, Growth)

Branch `feat/proofly-marketing`. Presentation only: no behaviour, query, permission or migration changed.
Figma `YmMNC5JOimqg61sI0eFI5a`, frames "Marketing / ...".

## Done
- **Discounts**: list in `ProoflyListPage` (summary line, stat tiles that filter by Active / Scheduled / Expired,
  centred status chip, only "Scheduled" coloured, friendly dates "1 Oct – 31 Oct", row actions, rows per page).
  Create / edit form in `ProoflyDetailPage` with the back link, summary line and key Save.
- **Analytics**: overview with `StatTile` KPIs (trend vs previous period) and the Proofly header; Live view with
  stat tiles over the globe and the activity card; Reports home with a query bar and grouped report cards.
- **Reports detail**: "What I understood" card (date range and comparison wired to the existing report engine),
  Bar / Line switch, Details table, CSV export.
- **Growth**: overview (stat tiles, header), Campaigns list (status tabs, Sent to / Opened / Sales / Status / Date,
  summary line), campaign editor and report, Automations list and editor, Links builder: all on the new header.
- Shared, additive: `StatusLabelChip` (any mapped status as a `StatusChip`, grey unless action is needed), the
  Proofly page shells and `RowMenu` copied unchanged from the Products branch.
- `routes.*` everywhere touched; 13 files left the `admin-routes` allow-list.

## Not done (and why)
- **Discount type picker** (Amount off products / order / Buy X get Y / Free shipping): Buy X get Y has no
  backend. The create form still opens directly.
- **Per-product discount amounts**: PR #294 is not on dev yet, so the existing "specific products" picker is kept.
- **Reports AI query**: no natural-language backend exists. The query bar finds reports by title and says
  plain-words questions are coming. Parsing, "What I understood" chips beyond date / comparison, the pie chart,
  saved reports, schedules, pin to Home and the AI summary are follow-ups.
- **Links list** (saved tagged links with clicks): no storage exists; the builder is restyled only.
- **Growth overview / campaign detail / automation flow builder**: restyled headers and tiles; the flow-builder
  canvas of the frame is not rebuilt.
- Hindi overlays for the new strings (discounts, analytics reports, campaigns) are not added: those sections
  have no overlay yet, English shows through `useCopy`.
- Browser check against Figma was skipped: no local login available to this session.
