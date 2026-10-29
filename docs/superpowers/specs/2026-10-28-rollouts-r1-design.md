# Rollouts R1: scheduled launches and events (design)

Owner, 28 Oct 2026: "I want the same market and rollout feature as Shopify." Agreed order:
M1 (done) → **R1** → M2 → M3 → R2 → M4–M6 (`markets-rollouts-plan`). This is R1.

## What it is
Shopify's Markets → Rollouts: save a set of store changes and let them go live at a set time,
for good (**Launch**) or for a period that rolls back by itself (**Event**, e.g. a Diwali sale:
a sale theme and sale discounts from Friday 00:00 to Monday 23:59, then everything returns).

Goals: a merchant prepares a sale ahead of time and nothing has to be clicked at midnight;
the end restores exactly what was live before; the merchant always sees what is scheduled.

Non-goals in R1 (R2): showing a change to only part of the visitors (traffic %), Experiments
(control vs treatment and results). Catalog changes wait for M3 (catalogs do not exist yet).

Anti-goals: a rollout must never leave the store half-changed (all of a rollout's changes apply
in one transaction or none do); ending must never lose edits the merchant made in between.

## Changes a rollout can hold (Shopify's set, minus catalogs)
1. **Theme: replace the live theme** with one from the theme library. "Edit theme for this
   rollout" = duplicate the live theme into the library, edit the copy in Customize, and the
   rollout publishes the copy (Shopify edits a rollout-only layer; a copy is our equivalent).
   One theme change per rollout.
2. **Checkout & accounts: replace the checkout branding** (Settings → Checkout → Branding) with
   a version saved in the rollout. One per rollout.
3. **Discounts: activate or deactivate** chosen discounts (up to 250). A discount can be in only
   one unended rollout.

## Lifecycle (Shopify's statuses)
- **Draft**: no start date, or no changes. **Scheduled**: has a start. **Active**: applied.
  **Paused** (Event only): rolled back early, can resume. **Ended**. **Archived**.
- Launch: at start, apply; it ends at once (changes are permanent).
- Event: at start, apply and remember what each change replaced (previous live theme id,
  previous branding, each discount's previous status); at end, by the merchant's choice made
  in advance or when ending by hand: **roll back** (restore what was there) or **apply
  permanently** (keep). Applied changes cannot be reverted afterwards (Shopify's rule).
- Rolling back restores today's state of what was replaced, not a snapshot: if the merchant
  edited the previous theme while the event ran, the edits stay (it is the same theme row).
- A worker job checks every minute for rollouts to start or end (store timezone shown in the
  admin; times stored in UTC). Starting or ending is one transaction per rollout and is
  idempotent (a re-run after a crash does nothing twice).

## Conflicts (checked on save)
- Blocked ("Resolve rollout conflicts"): two unended rollouts both changing the theme or the
  checkout with overlapping times; a discount already in another unended rollout.
- Warned ("Review rollout conflicts"): the theme a rollout will publish is deleted or replaced
  meanwhile (checked again at start; if it is gone the rollout fails to start and says why).

## Admin
- **Markets → Rollouts** (new page under Settings → Markets' group, as Shopify places it):
  list with status filter (Active, Scheduled, Draft, Paused, Ended), name, type, changes
  summary ("Theme · 3 discounts"), when it runs.
- **Create / edit** is a full page (no drawers): Name, type (Launch / Event), Changes ("Add
  changes" dialog: Online store theme, Checkout branding, Discounts), Scheduling (start; end
  for Event; "At the end: roll back / keep"), conflict banner, Save.
- Actions: Pause / Resume (Event), End now (roll back or keep), Archive, Delete (not while
  active). Status chips also on the theme library, the checkout branding page and the discounts
  list ("In rollout: Diwali sale").
- Copy in `data/rollouts.ts` with the Hindi overlay.

## Data (one migration)
- `rollout`: id, store_id, name, kind (`launch`|`event`), status, starts_at, ends_at,
  end_action (`rollback`|`apply`), started_at, ended_at, error, created_by, timestamps. RLS.
- `rollout_change`: id, store_id, rollout_id, kind (`theme`|`checkout_branding`|`discount`),
  target (theme id / discount id / null), value (jsonb: branding, or `active`/`disabled`),
  previous (jsonb, filled at start), applied_at. RLS. A partial unique index keeps one
  unended rollout per discount; theme/checkout overlaps are checked in the service.
- Worker queue `{rollouts}-tick` every minute over `stores_with_rollouts_due(now)` (SECURITY
  DEFINER, like the retention job).

## API, MCP, docs, tests
- `rollouts` router (list, get, create, update, start-now, pause, resume, end, archive,
  delete) behind new permissions `rollouts.read` / `rollouts.manage`; MCP actions with
  `end`/`delete` as sensitive.
- Merchant guide page "Rollouts", developer docs data model entry.
- Tests: apply and roll back each change kind; Launch keeps; Event rolls back; apply
  permanently; pause/resume; edits during an event survive rollback; conflicts; worker tick
  idempotent; a missing theme fails the start cleanly; store isolation.

## Left to the builder
Exact copy, list column layout, and how the "Add changes" dialog lists themes and discounts
(reuse the existing pickers).
