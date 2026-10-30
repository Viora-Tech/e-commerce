# Admin audit fixes (Shopify side-by-side, 30 Oct 2026)

One PR for the fixes from the page-by-page audit of admin.koomerce.app against Shopify admin
(205 findings, numbered in the audit list). Shopify was the benchmark: good ideas taken, not
copied. Branch `fix/admin-audit`.

## Import from Shopify

- Manual collections keep Shopify's product order (#66).
- Imported orders: payment method read from Shopify's gateway names (Analytics showed
  "Unknown" for 100 orders, #96); subtotal is before discounts, so the discount is not taken
  twice (#11); Shopify's timeline kept in `import_meta.history` and shown as "Before the
  move, on Shopify" (bulk imports only, #20).
- Pages keep Shopify's last-edited date (#132). Home page SEO title and description (#131).
- Discounts: minimum quantity, chosen customers and a fixed amount off each chosen product
  now import (#119); segment-only and variant-only ones are still refused, app discounts too.
- Store settings gain a **Customer segments** part: Shopify segment queries become our
  conditions; anything we cannot express is listed with its query (#87).
- Product categories (taxonomy id) and oversold stock (negative available) come over.
- Back in stock: "Bring over restock tags" turns `restock-<product>` customer tags into
  confirmed waiting signups (#198).
- The "Historical item (imported)" placeholder product is hidden from lists (`is_system_test`).

## Orders, products, customers

- Search finds orders by phone (any format), city, PIN code and product.
- Row menu follows read-only imports (#47); bulk Cancel asks first (#48); view chip counts
  search results (#50); cancelled orders struck through (#6); optional Delivery, Items,
  Phone, City columns (#7, #49); no "Unfulfilled" badge on cancelled orders (#22).
- Order page: notification names, never codes (#16, #166); one timeline list (#18); compact
  address block (#13); empty cards hide (#12, #84); product names are links (#21).
- Products: "No price" instead of ₹0 (#60); only filled extra fields, "Show N empty fields"
  (#51, #177); one save place for saved products (#58); collections pickable before the
  first save (#200); bulk edit opens on price/MRP/cost/SKU/stock (#205); SEO auto
  description skips spec tables (#65); MRP / Tags / Colours wording (#55, #57).
- Every form with a save bar asks "Leave without saving?" (`LeaveGuard`, #64, #202).
- One bulk bar on lists: every action in the floating bar, the top row only shows the
  selection (#8, #204); bulk More menu wider (#9).
- Detail pages centred at 75rem; lists stay full width (#14).
- Drafts: empty state (#34), tab title "Draft #N" (#32); collection tab title (#70).

## Home, analytics, apps

- Home counts follow Products/Inventory rules: "Restock N products" counts products (#2,
  #61, #72); "live now" once (#3).
- Analytics: browsers by name (#99); conversion counts tracked orders only; whole-unit money
  via `@commerce/money` `whole` (currency-aware).
- AI: net sales facts; no "Buy credits" on Unlimited (#176); approvals show readable rows and
  no false "cannot be undone" (#174).
- COD & RTO: "Score them" for open orders without a score; imported COD counts as COD (#199).
- GST invoices: cancelled orders leave the queue. Smoke-test carts never count as abandoned.
- Growth: automation emails can give each shopper a unique single-use code (#182); the
  Automations gallery lists the marketing flows (#181).
- Checkout: email and WhatsApp marketing opt-in, unticked (#153).
- Payments: "Manual payment methods" card with UPI ID and Bank transfer rows (#149).
- Meta channel wording (#136, #138); shipments views as tabs and labelled "Book by order
  number" (#39, #40); suppliers unique by name (#76); policy pages marked (#133); Shopify
  category content types on their own tab (#93); markets: flags and region presets (#115);
  themes: Public / Password on (#125); theme editor: panel opens on selection (#128), block
  names from their text (#126), schema help text (#129); blog delete at the bottom (#94);
  settings nav lights one tab (#116); 50 rows per page (#4, #89); 404 for bad ids.

## Not done here (owner / later)

- Group F (own PRs): shipping profiles (#159/#160), Pre-orders app, Settings redesign,
  Markets/Rollouts in the sidebar + Graph view, filter chips, Home smart cards, Inbox AI,
  multi-gateway routing (#148), draft number series (#26), server-side theme screenshots
  (#123), collection grid reorder (#67), web performance strip (#124), "usage detection" for
  files/menus/apps (#90, #92, #145), browse abandonment, and the **Shopify scope bundle**
  (`read_markets`, purchase orders, transfers, API 2026-10: #75, #114).
- Owner: deactivate the hand-made "Sonipat" location (#172), delete one "Uncle Panda"
  supplier, re-enter Kyomi PO #1, check `AI_MODEL_STRONG` in production (#175), look at the
  12:15 503 burst (#86), final Shopify re-sync after release (#62), switch Growth flows on at
  cutover (#180).
- To check together in Chrome: #38 (Ship now look), #203 (stock wording).
