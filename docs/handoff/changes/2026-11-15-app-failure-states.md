# App pages: failure states for the rest

Follow-up to the apps page pass (`2026-11-14-page-pass-apps.md`, "Still silent on failure").
Every page below now says "Could not load the …" with Try again when its read fails, and "You do
not have access" (no Try again) for a role whose read is FORBIDDEN. All use
`components/apps/shared/load-failed-state.tsx` (or the list table's `error` prop); copy is
`appsContent.couldNotLoad.*` with Hindi. Behaviour, data and layout are otherwise unchanged.

## Pages

- **Reviews › Questions:** a failed list read shows the failure in place of the cards (was a
  toast over old or no rows; the first load sat on a skeleton forever). Pager hidden meanwhile.
- **Reviews › Settings:** failure page with Try again (was a skeleton forever plus a toast).
- **Automations:** Workflows and Runs show the failure in the table with Try again (no-access as
  a page); Approvals and Templates fail with Try again (were a red line with no retry). Workflow
  and run pages fail with Try again when the workflow, run or catalogue cannot be read (the run
  page said "not here any more" for any failure, now only for NOT_FOUND; a failed catalogue kept
  both on a skeleton forever). Settings: the usage card has a skeleton and a failure (was hidden).
  New `useAutomationCatalogueLoad()` (the old hook is unchanged for the other pages).
- **Shopify import › Connect:** a failed connection read shows Try again (was the connect form,
  as if not connected). **Settings:** same for the connection (was "not connected"); a failed
  first Shopify check shows Try again in place of its skeleton (was a skeleton forever).
- **S3:** the connect page's failure uses the apps copy ("Could not load the connection"); the
  Move files card says when the move status could not be read (a running move looked like none).
- **Chatwoot conversations card** (customer and order pages): our own read failing shows the card
  with Try again (was "Could not reach Chatwoot" with no retry). Chatwoot-side errors unchanged.
- **India Post label page:** failure with the reason and Try again (was a plain line).
- **Delivery option page:** section skeleton while it loads and a failure page with Try again
  (was blank, with a toast).
- **Product page app sections:** Reviews and Back in stock draw skeleton lines while loading and
  fail with Try again (were blank, then a plain "Could not load this section").

## Copy

Added `couldNotLoad.questions, workflows, workflow, runs, run, approvals, usage, moveStatus,
conversations, label, option, reviews` (+ Hindi). Removed now-unused `automationsContent.loadFailed`
and `productPageContent.apps.failed` (+ Hindi).

## Not done

- The Reviews AI summary inside the product section stays hidden when its read fails (it is
  hidden for stores without summaries too).
- S3 when the storage read answers without an S3 provider still shows the skeleton (not a failure).

## Test

`components/apps/shopify-import/connect-page.test.tsx`: failure is not the connect form, Try
again reads again, FORBIDDEN shows no access.
