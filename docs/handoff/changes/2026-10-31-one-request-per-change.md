# One approval request per change

Owner report: the same change showed several times in Approvals; approving one left copies that
could no longer be approved.

- `packages/api/src/services/ai/assistant/duplicates.ts`: a request's key is its action plus its
  input with object keys sorted (computed in code, no migration). An advisory lock per key stops a
  double click from storing two.
- Asking again while the same change is open returns the open one (`alreadyRequested`), no copy:
  - Approvals rows (admin, API, MCP role ticks, assistant/MCP proposals sent on): any member's
    open request counts. The admin shows "Already requested — waiting for approval."
    (`approvalsContent.already`, read from `APPROVAL_QUEUED` `data.alreadyRequested`); MCP and the
    AI assistant get the same sentence in the tool result.
  - AI cards the asker reviews on the spot: only the asker's own repeat folds in.
- Approving or rejecting a request cancels its open twins (`result.duplicateOf`, a message saying
  why); the asker withdrawing closes only their own copies.
- Approvals list and the nav badge show each open request once (for copies stored before this).

Tests: `packages/api/test/approval-duplicates.test.ts`, `mcp-actions.test.ts` → "keeps one
request per change".
