# AI approvals: late checks for product text and discounts

AI and MCP proposals stay open 24 hours (#1717), so the store can change before someone approves.
Branch `fix/ai-approval-late-checks`.

## Product text update (`services/ai/assistant/actions/product-update.ts`)

- Propose now stores `before` in the resolved input: each proposed text field (title,
  description, search title, search description) as it was then, plus the tag change as a delta
  (`tags: { add, remove }`) instead of only the full list.
- Approve (`latePatch` in `actions/late-checks.ts`) reads the product again and applies a text field only if it still equals
  its `before` value (description compared as JSON with sorted keys, so jsonb key order does not
  matter). A field that already holds the proposed value counts as "already matches". Tags apply
  the add/remove to today's tags, so tags added since are kept.
- Something skipped: the result message says so, e.g. "Glide Mouse updated (description, search
  description only: search title was edited after this was proposed)".
- Nothing left to apply: approve fails with "Nothing was changed on Glide Mouse: … were edited
  after this was proposed. Ask again to start from the current text." The product is untouched.
- Proposals stored before this change have no `before`; they apply as proposed (old behaviour).
- Edit on the card re-runs propose, so `before` is refreshed then. Undo still restores the
  snapshot taken at approval.

## Discount (`actions/discount.ts`)

- `lateDateCheck` (`actions/late-checks.ts`) runs first on approve: an end date before the start, or a last day that passed
  while the proposal waited, fails with "LATE10 was not created: its last day (16 Nov) passed
  while it waited for approval. Ask again with new dates." No discount is created. (The schema
  already refused end ≤ start, but with the generic "could not be made" message.)

Both refusals use the existing path: a `ProposalProblem` from `execute` marks the action
`failed` with that message (the card and Activity show it), as for a code taken meanwhile.

Tests: `packages/api/test/ai-approval-late-checks.test.ts`.
