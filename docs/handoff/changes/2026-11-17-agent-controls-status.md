# AI agents on the Controls page read "On the list"

**What:** Sales channels → Agentic sales → Controls showed "Waiting for approval" for ChatGPT, Google AI Mode, Perplexity and Microsoft Copilot. The side card used `chipStatus`; it now uses `agentChipStatus`, like the agent cards (#879a4ec1e), so a requested agent reads "On the list · not live yet".

**Why:** no approval is ever asked from these agents (none can be joined automatically yet), so "Waiting for approval" was wrong (owner, 17 Nov 2026).

**File:** `apps/admin/src/components/sales-channels/controls-page.tsx`.
