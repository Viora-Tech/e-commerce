# Affiliates v1.1 "UpPromote parity for India": design

Date: 2026-10-24. Status: draft for owner review. Read against `origin/dev` at `dbe50859` (migrations end at `0159_profit`).
Extends `packages/plugin-affiliates` (v1 handoff: `docs/handoff/changes/2026-10-23-app-affiliates.md`). Research: `docs/research/2026-10-23-affiliate-apps.md` plus the 24 Oct market scan (UpPromote wins: 4.9 from 3,905 reviews). Tax points are research notes. **Every tax rule here needs a CA check**, and merchant copy says so.

## 1. Intent and goals

Our v1 engine is ahead of UpPromote on India: COD/RTO-aware hold, TDS, UPI and bank CSV, no revenue share. It falls behind on growth and control: one program, no auto-enrolment, weak fraud tools, a bare portal. v1.1 closes that gap in 7 PRs and keeps the engine's behaviour exactly as it is.

Goals: (1) many programs, a per-affiliate rate and order-value levels; (2) buyers become affiliates in one tap; (3) coupon-leak and duplicate-payee detection; (4) a portal creators actually use (deep links, QR, creatives, vanity codes); (5) custom signup forms and the missing emails; (6) GSTIN, GST on payouts and a quarterly 26Q export; (7) real analytics.

**Non-goals (v1.1):** moving money (no RazorpayX or Cashfree), gifting, store-credit payouts, bonuses, MLM, creator discovery, GST invoice generation, TDS filing, bulk email to affiliates (an Automations template can do it later), storefront Hindi (the storefront has no language mechanism: `apps/storefront/src/data/` has no `hi/`).

**Anti-goals (a failure even if it works):** any existing affiliate's rate, code, link or pending amount changes because of the migration. Commission paid on a cancelled, RTO or refunded order. An auto-enrolled buyer who never tapped "join". Fraud signals that silently reverse money (they hold it for review). PAN, bank, UPI or GSTIN in the clear in the DB, logs or CSV permissions below `settings.manage`. A right-side drawer anywhere (dialogs or full pages only).

## 2. Engine rules kept as they are (regression-tested in PR 1)

- Base per line: share of the order discount, GST removed, no shipping, no gift cards (`commission.ts` `lineBasePaise`). Capped at the base.
- Binding is coupon, then `?ref=` inside the cookie window, then lifetime. One commission per order (`affiliate_commission_store_order`). Test, imported, draft and cancelled orders earn nothing (`commissions.ts` `matchAffiliate`, `creditOrder`).
- Pending until delivered + `holdDays`. The hourly sweep re-reads the order and approves with TDS at credit (`hold.ts`, `approveDueCommissions`, `apps/worker/src/affiliates.ts`). Cancel, RTO and refund reverse it (pro-rata for a partial refund). If the commission is already in a payout, that becomes a clawback.
- `flag` non-null blocks approval until `decideCommission`. v1.1 reuses this for every new fraud reason: new flags keep the status `pending`. Only self-referral still records `reversed`, as today.

## 3. Data model and migrations

All new tables carry `store_id` and get `SELECT apply_store_rls();`, as `0158_affiliates.sql` does. Migrations are idempotent. The numbers below are the next free numbers today. **Builder: each PR takes the next free number when it opens and keeps its journal `when` last** (the 0158 practice).

| PR | Migration | Changes |
|---|---|---|
| 1 | `0160_affiliate_programs` | New `affiliate_program` (id, store_id, name, slug, is_default, archived_at, `rules` jsonb, timestamps; unique (store_id, slug), one default per store). `affiliate.program_id` (FK, nullable until backfill), `affiliate.rate_override` jsonb (a `CommissionRule` or null). `affiliate_commission.program_id` (snapshot, for analytics) |
| 2 | `0161_affiliate_enrol` | `affiliate.source` text `applied` / `added` / `enrolled` (default `applied`; existing rows `added` where `customer_id` is null). `affiliate.enrolled_order_id` uuid |
| 3 | `0162_affiliate_fraud` | New `affiliate_code` (affiliate_id, kind `link` / `coupon`, code, discount_id, status `active` / `retired`, created_at; unique (store_id, kind, code)). Backfilled from `affiliate.code` and `coupon_code`. New `affiliate_blocklist` (kind `email` / `email_domain` / `phone` / `ip` / `pan` / `payee`, value or blind index, note, created_by). `affiliate.pan_index`, `affiliate.payee_index` (HMAC blind indexes, like `phone_index`), `affiliate.signup_ip_index` |
| 4 | `0163_affiliate_creatives` | New `affiliate_creative` (program_id null = all, media_id → `media`, title, caption, sort, archived_at). `affiliate.code_request` jsonb (requested code, at, status) |
| 5 | `0164_affiliate_signup_form` | `affiliate.answers` jsonb (field id → value or private file key), `affiliate.rejected_at`, `affiliate.reject_reason` |
| 6 | `0165_affiliate_gst` | `affiliate.gst_registered` boolean (the GSTIN itself goes inside the encrypted `payout_details` blob). `affiliate_payout.gst_paise` int default 0 |
| 7 | `0166_affiliate_click_day` | New `affiliate_click_day` (affiliate_id, day date IST, clicks; PK store_id, affiliate_id, day). `affiliate.clicks` stays as the running total |

**Settings split (PR 1).** `AffiliateSettingsSchema` (`settings.ts`, still in `store.apps.settings.affiliates`) keeps the store-wide keys: `active`, `cookieDays`, `holdDays`, `minPayoutPaise`, `tds`, plus new `gst`, `fraud`, `autoEnrol`, `requirePanAboveThreshold`. A new client-safe `ProgramRulesSchema` holds `commission`, `overrides`, new `excludes` (product or collection ids), new `levels` (`[{ minOrderPaise, rule }]`, max 10), `scope`, `lifetimeDays`, `approval`, `coupon`, `tiers`, `pitch`, `terms`, and (PR 5) `form`. Cookie window and hold stay store-wide on purpose: they are tracking and returns facts, not plan terms.

**Moving today's program to a default program (0160 plus code).** For every store with an `affiliates` settings entry or any `affiliate` row, the SQL inserts one `affiliate_program` named "Default" (slug `default`, `is_default`) whose `rules` is a **copy of the whole existing blob**. `ProgramRulesSchema.parse` ignores the store-only keys and fills defaults, so the rules are identical. Then it sets `affiliate.program_id` to it. The program keys stay in the store blob, unread, so a rollback of the code still works. A later cleanup removes them. `loadProgram` lazily creates the default program for stores that install after the migration. Test: the whole v1 `flow.test.ts` passes unchanged against a migrated store.

## 4. Engine changes

- **Program per order.** `creditOrder` matches the affiliate first (same order of checks), then loads the affiliate's program (`program_id`, else the default). Program `scope`/`lifetimeDays` decide first-order versus lifetime. For a lifetime match, the bound affiliate's program is the one checked.
- **Rule precedence per line:** program excludes (line earns 0 and leaves the base) > product override > collection override > the affiliate's `rate_override` > the order-value level > the program default. A tier lifts whichever default-percent rule wins (`max(tier.bp, rule.bp)`, today's rule). **Call:** the level is measured on the goods total after discount, GST included, without shipping. That is the "₹2,000 order" a merchant thinks in. The commission itself is still on the ex-GST base. The admin preview shows both figures.
- **Moving an affiliate between programs** affects new orders only. The commission is set when the order is placed, so pending ones keep their amount. Their coupon's value updates to the new program's (this fixes UpPromote's "coupon doesn't follow the move" complaint).
- **Codes table (PR 3).** Coupon matching looks up active `affiliate_code` coupons. `?ref=` matching accepts active **and retired** link codes, because old posts must keep earning. A suspended affiliate still earns nothing. Rotating a leaked coupon retires it (its discount is disabled) and mints a new one.
- **Fraud (PR 3), pure in `fraud.ts`, flag-and-hold:** `coupon_leak_site` = coupon order, no matching click, and the attribution referrer host is on a coupon-site list (GrabOn, CouponDunia, CashKaro, DesiDime... a store-editable list). `coupon_spike` = clickless coupon orders in 24 h above `fraud.spikeMultiple` × the 28-day daily median (minimum 5). `blocked_buyer` = the order's email, domain or phone is on the blocklist. Without analytics consent there is no referrer, so only the spike rule can fire (stated in the copy). **Affiliate-level:** a PAN or payee (UPI id, or account + IFSC) index shared with another affiliate, or a blocklist hit at signup (email, phone, IP), marks the affiliate "needs review". Their payout candidate gets blocker `review`. Signup on a blocked IP or email is refused. The blind indexes join `refreshAffiliatePhoneIndexes`, so `rotate-secrets` recomputes them (`secrets.ts`).
- **Auto-enrol (PR 2).** `autoEnrol: { mode: 'off' | 'invite', programId, minOrderPaise }`. The plugin's `orderLinks` (`packages/plugins/src/types.ts`, already shown on the thank-you page and in order emails) returns "Share and earn ₹X". It links to `/affiliate/join?t=<HMAC token over orderId>`. One tap creates (or returns) the affiliate for `order.customer_id` (place-order upserts the customer by phone) in the Customers program, auto-approved, with `source = 'enrolled'`. Self-referral guards apply unchanged. **Call:** no "enrol everyone silently" mode (see Q1).
- **GST and TDS (PR 6).** When the affiliate is GST-registered, `payout.gst_paise = round(gst.bp × (gross − clawback))`, default 18% (CA check). Net = gross − clawback + GST − TDS. TDS stays on the ex-GST commission, as built. New blocker `no_pan` applies when `requirePanAboveThreshold` is set and the FY credit has passed the threshold. The 26Q export works per quarter on IST credit date (`approvedAt`): name, PAN or `PANNOTAVBL`, section label from settings (default "393(1) Sl. 1(ii) / 194H", CA check), credit date, amount, rate, TDS. Commissions reversed after credit are listed separately.
- **New outbox events:** `affiliate.applied`, `affiliate.rejected`, `affiliate.enrolled`, `affiliate.flagged` (`packages/core/src/outbox/types.ts`, app fan-out like the others). `AffiliateNotice` gains `rejected` (`emails.ts`, `TemplateData.affiliate.kind`). The merchant "new application" alert is a new `staff_affiliate_application` message (group `you`, like `staff_new_order`).

## 5. Screens (admin copy in `apps/admin/src/data/affiliates.ts` + `data/hi/affiliates.ts`; storefront in `apps/storefront/src/data/affiliate.ts`, English only)

**Admin** (`apps/admin/src/components/apps/affiliates/*`; pages added to `plugin.ts` `admin.pages` and `apps/admin/src/apps/registry.ts`):
- **Programs** (new list page `programs`, full-page editor `programs/[id]`): name and signup link, commission (reuses `commission-settings.tsx`), order-value levels, exclusions, scope, approval, coupon, tiers, signup page (pitch, terms, form builder in PR 5), and "Customers program / Share and earn" (PR 2). Archiving a program asks in a dialog where its affiliates move.
- **Settings** keeps the store-wide fields, plus cards for Fraud (coupon sites, spike), Blocklist (table, add in a dialog), GST and TDS.
- **Affiliate detail:** Program select and Own rate card, Codes card (rotate; approve or decline a vanity request), Needs-review card with reasons, signup answers (private files by signed link), and a GST registered badge.
- **Commissions:** a new "Needs review" tab with a reason column, using the existing Clear / Reverse actions.
- **Creatives** (new page): upload through the media store, captions, which program.
- **Payouts:** a GST column and a "TDS report (26Q)" dialog (pick a quarter, download the CSV). The export needs `settings.manage` and is excluded from MCP, like `exportCsv`.
- **Overview (PR 7):** revenue by week or month, conversion (orders ÷ clicks), top affiliates, top products (commission joined to order lines), filter by program, and a ledger CSV (`marketing.read`).
- **Reject** opens a dialog with an optional reason that is emailed.

**Storefront** (`app/-s/[storeId]/affiliate/page.tsx`, `components/affiliate/*`):
- `/affiliate?program=<slug>` renders that program's form. The default is the default program, and the Customers program is not open to applications.
- `/affiliate/join` is the one-tap enrol page.
- Dashboard additions: a link builder (search a product or paste a store URL, get the `?ref=` link), a QR code per link (the `qrcode` package is already a storefront dependency) with PNG download, a WhatsApp share per link, a Creatives tab, a vanity-code request, and a monthly chart plus conversion (PR 7). File fields upload privately, the way returns photos do (`lib/return-actions.ts`), with images or PDF up to 5 MB.

## 6. PR breakdown (each PR into `dev`, each with a `docs/handoff/changes/YYYY-MM-DD-*.md` note and an update to `apps/docs/content/merchant-guide/apps/affiliates.mdx`)

| # | PR | Migration | Size | Depends on |
|---|---|---|---|---|
| 1 | Programs, per-affiliate rate, order-value levels, exclusions | 0160 | M (3–4 d) | — |
| 2 | Auto-enrol: Share and earn, Customers program | 0161 | M (2–3 d) | 1 |
| 3 | Fraud pack: codes table, coupon-leak, spike, blocklists, duplicate PAN/payee | 0162 | M (2–3 d) | 1 |
| 4 | Portal: link builder, QR, creatives, vanity codes | 0163 | M (2–3 d) | 3 |
| 5 | Signup form builder, rejected email, merchant new-application alert | 0164 | S–M (2 d) | 1 |
| 6 | GSTIN, GST on payouts and CSV, 26Q export, PAN blocker | 0165 | S (1 d) | — |
| 7 | Analytics: daily clicks, trends, conversion, top products, ledger CSV | 0166 | S (1 d) | 1 |

Total about 2–3 weeks for one agent. PRs 6 and 7 can run in parallel with 2–5. After 1 is merged, at most 3 agents should run at once (PC limit).

**Testing.** Pure tests (`test/rules.test.ts`): precedence, levels, excludes, the tier × override interaction, GST/TDS net, IST quarter edges, leak and spike rules. DB flow tests (`test/flow.test.ts`): the v1 suite unchanged on a migrated store; default-program backfill; moving an affiliate between programs; the enrol token (bad, replayed, someone else's order); flag → hold → clear → approve; retired link code still earns; duplicate payee blocks the payout; blocklisted signup; 26Q rows. API permission tests for the new procedures. Add MCP classification for the new actions: reads free, writes follow the approval switch, payouts and blocklist edits sensitive, the 26Q export excluded.

**Rollout.** No feature flag. PR 1's migration is a no-op in behaviour (verified by the parity suite). Each PR is checked on vioratech.in with the Waimers store before the next dev → main release, plus the release smoke checklist. The cleanup of program keys from the store blob happens one release after PR 1.

**Later.** v2:
- RazorpayX/Cashfree auto-payouts ("connect" per merchant, KYC theirs) **L**.
- Gifting/seeding as zero-value orders with per-creator FMV per FY and s.194R → s.393(1) Sl. 8(iv) TDS (10% over ₹20k, CA check) **M**.
- Store-credit payouts **M**. The `gift_card` table with its balance already exists, so issue a gift card (new `source`) rather than build a customer balance.
- Bonuses and bounties **S–M**.
- MLM **M**.

v3: creator discovery (needs a Meta/YouTube data partner) **L**, and a marketplace on apps.koomerce.app **L**.

## 7. Builder's calls (owner can overturn)

Level threshold measured on goods after discount incl. GST. Cookie window and hold stay store-wide. Retired link codes keep earning forever. At most 3 active coupon codes per affiliate. Coupon-site list and spike multiple (default 3×) are editable. GSTIN lives inside the encrypted blob. Customers program is enrol-only. Ledger CSV needs `marketing.read`, 26Q needs `settings.manage`. Exact table and column names beyond §3, component split, empty states and the copy wording are the builder's.

## 8. Questions only the owner can answer

1. **Auto-enrol mode.** Recommended: invite only (one tap). The alternative, "every buyer becomes an affiliate automatically" (Social Snowball), creates accounts and messages without consent (DPDP risk). → §4 auto-enrol.
2. **Customers program reward.** Recommended: cash commission like other affiliates, with a higher minimum payout. The alternative pulls gift-card store credit from v2 into PR 2 (+1–2 d). → §6.
3. **GST in the amount to pay.** Recommended: add 18% to the payout for GST-registered affiliates (they invoice it and the merchant claims ITC; CA check). The alternative shows it for reconciliation only. → PR 6.
4. **Plan limits.** Recommended: no new limits. Unlimited programs and all of v1.1 stay in the app's existing price (included from Growth, ₹299/month below). → billing unchanged.
