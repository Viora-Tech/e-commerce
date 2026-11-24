# Knowledge base "Scan my store" fixed; AI failures now logged

Branch `fix/knowledge-scan` (from `origin/dev`). No migration.

**Bug (live, 24 Nov):** Agentic sales → Knowledge base → Scan my store always failed with "The
AI could not finish the scan this time" (`BAD_GATEWAY`, `model_failed`) after 8–11 s.

**Cause:** `StoreKnowledgeSchema` (`packages/ai/src/store-knowledge.ts`) had `.max(12)` on the
brands / categories / values lists and `.max(6)` on the FAQ. The scan sends the model up to 25
brands, 20 product types and 30 collections (`loadKnowledgeSources` in core) and asks for the
brands "from the brand list", so a store like Waimers gets more than 12 back. The provider does
not enforce array limits while writing, but the AI SDK validates the answer with zod
afterwards, so every scan ended in `NoObjectGeneratedError` ("did not match schema"). The bare
`catch {}` in the API service hid it. The product writer and SEO keywords schemas already avoid
limits for exactly this reason (comment in `product-writer/schema.ts`).

**Fix:**
- No limits in the schema; the "at most 12" stays in the field description. Trimming already
  happens in core (`cleanValue`: 12 tags, 8 questions, 600 characters).
- The scan gets its own output budget, `STORE_KNOWLEDGE_MAX_OUTPUT_TOKENS` (4,000), via a new
  optional `maxOutputTokens` on `generateStructured`; the product writer's 1,800 was close to
  what a full scan writes.
- `packages/api/src/services/ai/model-failure.ts`: `logModelFailure(task, err)` writes one
  `ai call failed` line (error name, provider status code, finish reason, output tokens, zod
  issue paths; never the prompt or the model's answer). Called before the `BAD_GATEWAY` in the
  scan, product writer, SEO keywords, section writer, review reply and query writer.

**Tests:** `packages/ai/test/store-knowledge.test.ts` (an answer with 25 brands passes, the JSON
schema sent has no limits, the budget is passed, a cut-off answer throws) and
`packages/api/test/ai-model-failure.test.ts` (fields for schema mismatch, cut-off answer and
provider error, nothing from the answer leaks).

**Left:** `section-writer.ts` and `assistant/theme-outline.ts` in `packages/ai` still use
`.max()` in model schemas. If they fail on live, the new log line will name the path.
