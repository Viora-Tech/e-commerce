# Guardrail sweep fixes after #1430, #1433, #1437 (#1444)

No behaviour change.
- RapidShyp: `edd` parsing moved to `src/edd.ts` and counts India's day with `dayKey` from
  `@commerce/dates` (new dependency); status codes moved to `src/status.ts`. rapidshyp.ts is back under 910 lines.
- ShipGlobal: API answer types moved to `src/answers.ts`; shipglobal.ts under 500 lines.
- Storefront: `anonymous-visit.ts` imports `server-only`; the beacon reads the secret via `settingsSecret()`.
- `bun run test:sweeps`: 28 files pass.
