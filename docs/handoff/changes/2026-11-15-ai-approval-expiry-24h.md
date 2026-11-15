# AI and MCP proposals stay open for 24 hours

Branch `fix/ai-approval-expiry-24h`. An assistant card or an AI app's (MCP) proposed change
expired after 60 minutes; the owner missed one overnight. `ASSISTANT_LIMITS.proposalTtlMinutes`
(`packages/ai/src/assistant/limits.ts`) is now `24 * 60`; `proposeAction` and `reviseAction`
(`packages/api/src/services/ai/assistant/service.ts`) read it. Requests queued in Settings →
Approvals for a different member were already 7 days (`APPROVAL_TTL_DAYS`, `views.ts`) and are
unchanged. No migration, no worker job (expiry is read from `expires_at` when a list loads).

Docs updated: merchant guide `home/ask-ai.mdx` ("within 24 hours") and `settings/mcp-and-api.mdx`,
developer docs `ai-assistant.mdx` and `mcp-and-api.mdx`. No admin copy named the hour.
`test/ai-assistant.test.ts` checks a new proposal's `expiresAt` is `createdAt` + 24 h.

Is approving a day later safe? Approve re-checks: a price change skips variants whose price
changed since; a taken discount code, or a product, collection or order deleted since, is
refused; a queued admin action re-runs the procedure as the approver. Two gaps, left as they
were: **product text update** writes the fields as proposed, and its tags are the full list
worked out at propose time, so tags or text edited in between are overwritten (Undo restores
them); **discount** does not re-check that its end date is still ahead, so a code whose end
passed while waiting is created already ended.
