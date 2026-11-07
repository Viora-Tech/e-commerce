# Guardrail sweeps pass again

Recent merges left `bun run test:sweeps` failing, and nothing runs it on PRs while GitHub Actions is off, so run it locally before opening one.

`share-image.ts` is server only and reads the store through the new `storeShareSettings` in core. The MCP action docs are regenerated. New test files have their headers. `engine.ts` and `render.ts` are listed as over 500 lines, to split when they next change.
