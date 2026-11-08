# AI assistant test: discount dates relative to today (2026-11-08)

- `packages/api/test/ai-assistant.test.ts` asked for "20 Oct to 5 Nov". The mock plan reads a
  day-month range as the current year, so after 5 Nov the end date was in the past and the
  proposal was refused. The test now asks for today to today + 20 days (#1317). Test-only.
