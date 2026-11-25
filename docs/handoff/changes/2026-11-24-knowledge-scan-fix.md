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

**Same fix for the other model schemas (second commit):**
- Section writer (`packages/ai/src/section-writer.ts`): no `.max()`/`.min()` in
  `SectionProposalSchema`; limits live in `SECTION_WRITER_LIMITS` and the descriptions, and
  `clampSectionProposal` cuts text at a word break and drops extra columns / questions. The API
  service clamps before building props.
- Theme edits (`assistant/theme-outline.ts`): `ThemeEditInput` (the `proposeThemeEdit` tool
  input) has no limits. `themeEditSummary` cuts the card summary to 200 characters ("Theme
  edit" when empty). Too many changes (over 20), none, or a value over 2,000 characters is not
  trimmed but returned to the model as an error by `validateThemeEdits`, so it retries instead
  of a merchant's change being silently dropped. `ThemeOutlineSchema` keeps its limits: it
  checks the browser's request, not the model.
- Tests: `packages/ai/test/model-schema-limits.test.ts`.
