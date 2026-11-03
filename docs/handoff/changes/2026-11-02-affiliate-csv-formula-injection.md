# Fix: CSV formula injection in affiliate ledger + GSTR-1 exports

**Date:** 2026-11-02
**Type:** security fix (low severity, confirmed)

## What
A self-registered affiliate controls free text (their display name) that is written into the
affiliate commissions ledger CSV export. `csvCell` in `packages/plugin-affiliates/src/stats.ts`
quoted separators/quotes but did **not** neutralise a leading `=`, `+`, `-`, or `@`, so a merchant
opening the export in a spreadsheet could execute an attacker-authored formula (CSV/spreadsheet
formula injection — HYPERLINK phishing, Google Sheets `IMPORT*` auto-exfiltration, Excel DDE).

The identical missing guard existed in the GSTR-1 export cell helper
(`packages/invoices/src/gstr1.ts`).

## Fix
Added the same leading-formula neutralisation already used by `packages/plugin-affiliates/src/payouts.ts`
(`/^[=+\-@]/` → prefix with `'`) to both `stats.ts` `csvCell` (now exported) and `gstr1.ts` `cell`.
Behaviour for ordinary values is unchanged; only cells beginning with a formula character are
prefixed with a single quote.

## Files
- `packages/plugin-affiliates/src/stats.ts` — guard added to `csvCell`; now exported for test.
- `packages/invoices/src/gstr1.ts` — guard added to `cell`.
- `packages/plugin-affiliates/test/csv-injection.test.ts` — new regression test (both export helpers).

## Source
Found by the Cloudflare security-audit-skill run-1 (source-only). Confirmed finding F1; GSTR-1 was
needs_validation (same root cause, fixed defensively). See `~/security-audit-skill/e-commerce/run-1/`.
